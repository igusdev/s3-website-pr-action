import { context } from '@actions/github';
import { validateEnvVars } from '../utils/env';
import { deactivateDeployments, deleteDeployments } from '../utils/github';
import { deleteBucket } from '../utils/s3';

export const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];

export const prClosed = async (
  bucketName: string,
  environmentPrefix: string,
) => {
  const { repo } = context;

  validateEnvVars(requiredEnvVars);

  await deleteBucket(bucketName);
  await deactivateDeployments(repo, environmentPrefix);
  await deleteDeployments(repo, environmentPrefix);

  console.log('S3 bucket removed');
};
