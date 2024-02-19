import { context } from '@actions/github';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { githubClient } from '../clients/github';
import { getAwsRegion, websiteEndpoint } from '../utils/aws';
import { validateEnvVars } from '../utils/env';
import { deactivateDeployments } from '../utils/github';
import { createBucket, deleteBucket, uploadDirectory } from '../utils/s3';

export const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'GITHUB_TOKEN',
];

export const prUpdated = async (
  bucketName: string,
  uploadDir: string,
  environmentPrefix: string,
) => {
  const region = getAwsRegion();
  const websiteUrl = `http://${bucketName}.${websiteEndpoint[region]}`;
  const { repo, payload } = context;
  const branchName = payload.pull_request?.head?.ref;

  console.log('PR Updated');

  validateEnvVars(requiredEnvVars);

  await createBucket(bucketName, region);
  await deactivateDeployments(repo, environmentPrefix);

  try {
    const deployment = (await githubClient.rest.repos.createDeployment({
      ...repo,
      ref: `refs/heads/${branchName}`,
      environment: `${environmentPrefix || 'pr-'}${
        payload.pull_request?.number
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
  } catch (error) {
    console.error(`Couldn't deploy website`, error);
    await deleteBucket(bucketName);
    await deactivateDeployments(repo, environmentPrefix);
  }
};
