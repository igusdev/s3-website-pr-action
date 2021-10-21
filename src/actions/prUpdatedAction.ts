import * as github from '@actions/github';
import {
  CreateBucketCommand,
  PutBucketWebsiteCommand,
} from '@aws-sdk/client-s3';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import githubClient from '../githubClient';
import S3 from '../s3Client';
import checkBucketExists from '../utils/checkBucketExists';
import deactivateDeployments from '../utils/deactivateDeployments';
import s3UploadDirectory from '../utils/s3UploadDirectory';
import validateEnvVars from '../utils/validateEnvVars';

export const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'GITHUB_TOKEN',
];

export default async (
  bucketName: string,
  uploadDirectory: string,
  environmentPrefix: string
) => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const websiteUrl = `http://${bucketName}.s3-website.${region}.amazonaws.com`;
  const { repo } = github.context;
  const branchName = github.context.payload.pull_request!.head.ref;

  console.log('PR Updated');

  validateEnvVars(requiredEnvVars);

  const bucketExists = await checkBucketExists(bucketName);

  if (!bucketExists) {
    console.log('S3 bucket does not exist. Creating...');
    await S3.send(
      new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration: { LocationConstraint: region },
      })
    );

    console.log('Configuring bucket website...');
    await S3.send(
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
    environment: `${environmentPrefix || 'pr-'}${
      github.context.payload.pull_request!.number
    }`,
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
    await s3UploadDirectory(bucketName, uploadDirectory);

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
