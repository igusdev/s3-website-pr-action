import { context } from '@actions/github';
import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import type { SdkError } from '@aws-sdk/types';
import { s3Client } from '../clients/aws';
import {
  deactivateCloudFrontDistribution,
  deleteCloudFrontDistribution,
  getCloudfrontDistributionDetails,
} from '../utils/cloudfront';
import { validateEnvVars } from '../utils/env';
import { deactivateDeployments, deleteDeployments } from '../utils/github';
import { getHostedZone, removeRecord } from '../utils/route53';
import { checkBucketExists } from '../utils/s3';

export const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];

export const prClosed = async (
  bucketName: string,
  environmentPrefix: string,
  domainName?: string
) => {
  const { repo } = context;

  validateEnvVars(requiredEnvVars);

  if (await checkBucketExists(bucketName)) {
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
  } else {
    console.log('S3 bucket does not exist.');
  }

  if (domainName) {
    const deploymentDomainName = `${bucketName}.${domainName}`;

    const zone = await getHostedZone(domainName);
    if (!zone) {
      throw new Error(
        `Could not find hosted zone for domain ${domainName}. Please make sure it's already created on AWS.`
      );
    }

    const distribution = await getCloudfrontDistributionDetails(
      deploymentDomainName
    );

    if (distribution) {
      try {
        await removeRecord(
          zone.Id as string,
          deploymentDomainName,
          distribution.DomainName as string
        );
      } catch (e) {
        const error = e as SdkError;
        if (error.name !== 'NoSuchDistribution') {
          throw e;
        }
      }

      await deactivateCloudFrontDistribution(distribution);
      await deleteCloudFrontDistribution(distribution.Id as string);
    }
  }

  await deactivateDeployments(repo, environmentPrefix);
  await deleteDeployments(repo, environmentPrefix);

  console.log('S3 bucket removed');
};
