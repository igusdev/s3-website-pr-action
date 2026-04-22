import { context } from '@actions/github';
import { githubClient } from '../clients/github';

export const deactivateDeployments = async (
  repo: {
    owner: string;
    repo: string;
  },
  environmentPrefix: string,
) => {
  const environment = `${environmentPrefix || 'pr-'}${
    context.payload.pull_request?.number
  }`;

  const deployments = await githubClient.rest.repos.listDeployments({
    ...repo,
    environment,
  });

  const existing = deployments.data.length;
  if (existing < 1) {
    console.log('No exiting deployments found for pull request');
    return;
  }

  for (const deployment of deployments.data) {
    console.log(`Deactivating existing deployment - ${deployment.id}`);

    try {
      await githubClient.rest.repos.createDeploymentStatus({
        ...repo,
        deployment_id: deployment.id,
        state: 'inactive',
      });
    } catch (error) {
      console.error(`Failed to deactivate deployment ${deployment.id}:`, error);
    }
  }
};

export const deleteDeployments = async (
  repo: {
    owner: string;
    repo: string;
  },
  environmentPrefix: string,
) => {
  const environment = `${environmentPrefix || 'pr-'}${
    context.payload.pull_request?.number
  }`;

  const deployments = await githubClient.rest.repos.listDeployments({
    ...repo,
    environment,
  });

  const existing = deployments.data.length;
  if (existing < 1) {
    console.log('No exiting deployments found for pull request');
    return;
  }

  for (const deployment of deployments.data) {
    console.log(`Deleting existing deployment - ${deployment.id}`);

    try {
      await githubClient.rest.repos.deleteDeployment({
        ...repo,
        deployment_id: deployment.id,
      });
    } catch (error) {
      console.error(`Failed to delete deployment ${deployment.id}:`, error);
    }
  }
};
