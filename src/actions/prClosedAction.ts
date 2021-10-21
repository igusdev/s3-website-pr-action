import * as github from '@actions/github';
import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import S3 from '../s3Client';
import deactivateDeployments from '../utils/deactivateDeployments';
import deleteDeployments from '../utils/deleteDeployments';
import validateEnvVars from '../utils/validateEnvVars';

export const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];

export default async (bucketName: string, environmentPrefix: string) => {
  const { repo } = github.context;

  validateEnvVars(requiredEnvVars);

  console.log('Emptying S3 bucket...');

  console.log('Fetching objects...');

  const objects = await S3.send(
    new ListObjectsV2Command({ Bucket: bucketName })
  );

  if (objects.Contents && objects.Contents.length >= 1) {
    console.log('Deleting objects...');
    await S3.send(
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

  await S3.send(new DeleteBucketCommand({ Bucket: bucketName }));

  await deactivateDeployments(repo, environmentPrefix);
  await deleteDeployments(repo, environmentPrefix);

  console.log('S3 bucket removed');
};
