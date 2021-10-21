import { context } from '@actions/github';
import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { s3Client } from '../clients/s3';
import { validateEnvVars } from '../utils/env';
import { deactivateDeployments, deleteDeployments } from '../utils/github';

export const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];

export const prClosed = async (
  bucketName: string,
  environmentPrefix: string
) => {
  const { repo } = context;

  validateEnvVars(requiredEnvVars);

  console.log('Emptying S3 bucket...');

  console.log('Fetching objects...');

  const objects = await s3Client.send(
    new ListObjectsV2Command({ Bucket: bucketName })
  );

  if (objects.Contents && objects.Contents.length >= 1) {
    console.log('Deleting objects...');
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: objects.Contents.map((object) => ({
            Key: object.Key,
          })),
        },
      })
    );
  } else {
    console.log('S3 bucket already empty.');
  }

  await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));

  await deactivateDeployments(repo, environmentPrefix);
  await deleteDeployments(repo, environmentPrefix);

  console.log('S3 bucket removed');
};
