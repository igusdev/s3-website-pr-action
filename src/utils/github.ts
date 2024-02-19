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
    repo: repo.repo,
    owner: repo.owner,
    environment,
  });

  const existing = deployments.data.length;
  if (existing < 1) {
    console.log('No exiting deployments found for pull request');
    return;
  }

  for (const deployment of deployments.data) {
    console.log(`Deactivating existing deployment - ${deployment.id}`);

    await githubClient.rest.repos.createDeploymentStatus({
      ...repo,
      deployment_id: deployment.id,
      state: 'inactive',
    });
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

  const deployments = await githubClient.graphql<{
    repository?: { deployments?: { nodes: { id: string }[] } };
  }>(
    `
        query GetDeployments($owner: String!, $repo: String!, $environments: [String!]) {
          repository(owner: $owner, name: $repo) {
            deployments(first: 100, environments: $environments) {
              nodes {
                id
              }
            }
          }
        }`,
    { ...repo, environments: [environment] },
  );

  const nodes = deployments.repository?.deployments?.nodes;

  console.log(JSON.stringify(deployments));

  if (!nodes || nodes.length <= 0) {
    console.log('No exiting deployments found for pull request');
    return;
  }

  for (const node of nodes) {
    console.log(`Deleting existing deployment - ${node.id}`);

    await githubClient.graphql(
      `
            mutation DeleteDeployment($id: ID!) {
              deleteDeployment(input: {id: $id} ) {
                clientMutationId
              }
            }
          `,
      { id: node.id },
    );
  }
};
