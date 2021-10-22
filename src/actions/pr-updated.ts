import { context } from '@actions/github';
import {
  CreateBucketCommand,
  PutBucketWebsiteCommand,
} from '@aws-sdk/client-s3';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { s3Client } from '../clients/aws';
import { githubClient } from '../clients/github';
import { getCertificateARN } from '../utils/acm';
import { getAwsRegion, websiteEndpoint } from '../utils/aws';
import {
  createCloudFrontDistribution,
  getDeployedCloudfrontDistribution,
} from '../utils/cloudfront';
import { validateEnvVars } from '../utils/env';
import { deactivateDeployments } from '../utils/github';
import {
  createOrUpdateRecord,
  getHostedZone,
  recordNeedsUpdate,
} from '../utils/route53';
import { checkBucketExists, uploadDirectory } from '../utils/s3';

export const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'GITHUB_TOKEN',
];

export const prUpdated = async (
  bucketName: string,
  uploadDir: string,
  environmentPrefix: string,
  domainName?: string
) => {
  const region = getAwsRegion();
  const bucketDomainName = `${bucketName}.${
    websiteEndpoint[region as keyof typeof websiteEndpoint]
  }`;
  let websiteUrl = `http://${bucketDomainName}`;

  const { repo, payload } = context;
  const branchName = payload.pull_request?.head.ref;

  console.log('PR Updated');

  validateEnvVars(requiredEnvVars);

  const bucketExists = await checkBucketExists(bucketName);

  if (!bucketExists) {
    console.log('S3 bucket does not exist. Creating...');
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration: { LocationConstraint: region },
      })
    );

    console.log('Configuring bucket website...');
    await s3Client.send(
      new PutBucketWebsiteCommand({
        Bucket: bucketName,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: 'index.html' },
          ErrorDocument: { Key: 'index.html' },
        },
      })
    );
  } else {
    console.log('S3 Bucket already exists. Skipping creation...');
  }

  if (domainName) {
    const deploymentDomainName = `${bucketName}.${domainName}`;

    const zone = await getHostedZone(domainName);
    if (!zone) {
      throw new Error(
        `Could not find hosted zone for domain ${domainName}. Please make sure it's already created on AWS.`
      );
    }

    const certificateARN = await getCertificateARN(domainName);
    if (!certificateARN) {
      throw new Error(
        `Could not find certificate for domain ${domainName}. Please make sure it's already created on AWS.`
      );
    }

    let distribution = await getDeployedCloudfrontDistribution(
      deploymentDomainName
    );
    if (!distribution) {
      distribution = await createCloudFrontDistribution(
        deploymentDomainName,
        bucketDomainName,
        certificateARN
      );
    }

    if (
      await recordNeedsUpdate(
        zone.Id as string,
        deploymentDomainName,
        distribution.DomainName as string
      )
    ) {
      await createOrUpdateRecord(
        zone.Id as string,
        deploymentDomainName,
        distribution.DomainName as string
      );
    }

    websiteUrl = `https://${deploymentDomainName}`;
  }

  await deactivateDeployments(repo, environmentPrefix);

  const deployment = (await githubClient.rest.repos.createDeployment({
    ...repo,
    ref: `refs/heads/${branchName}`,
    environment: `${environmentPrefix || 'pr-'}${payload.pull_request?.number}`,
    auto_merge: false,
    transient_environment: true,
    required_contexts: [],
  })) as RestEndpointMethodTypes['repos']['createDeployment']['response'];

  if ('id' in deployment.data) {
    await githubClient.rest.repos.createDeploymentStatus({
      ...repo,
      deployment_id: deployment.data.id,
      state: 'in_progress',
    });

    console.log('Uploading files...');
    await uploadDirectory(bucketName, uploadDir);

    await githubClient.rest.repos.createDeploymentStatus({
      ...repo,
      deployment_id: deployment.data.id,
      state: 'success',
      environment_url: websiteUrl,
      description: `Deployed to: ${websiteUrl}`,
    });

    console.log(`Website URL: ${websiteUrl}`);
  }
};
