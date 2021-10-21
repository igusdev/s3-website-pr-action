import { context } from '@actions/github';
import {
  CreateBucketCommand,
  PutBucketWebsiteCommand,
} from '@aws-sdk/client-s3';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { githubClient } from '../clients/github';
import { s3Client } from '../clients/s3';
import { validateEnvVars } from '../utils/env';
import { deactivateDeployments } from '../utils/github';
import { checkBucketExists, uploadDirectory } from '../utils/s3';

export const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'GITHUB_TOKEN',
];

export const prUpdated = async (
  bucketName: string,
  uploadDir: string,
  environmentPrefix: string
) => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const websiteUrl = `http://${bucketName}.s3Client-website.${region}.amazonaws.com`;
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
