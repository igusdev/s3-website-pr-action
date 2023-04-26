import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  ObjectOwnership,
  PutBucketWebsiteCommand,
  PutObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { lookup } from 'mime-types';
import { normalize } from 'path';
import { s3Client } from '../clients/s3';
import { readRecursively } from './fs';

export const filePathToS3Key = (filePath: string) => {
  return filePath.replace(/^(\\|\/)+/g, '').replace(/\\/g, '/');
};

export const checkBucketExists = async (bucketName: string) => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteBucket = async (bucketName: string) => {
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
};

export const createBucket = async (bucketName: string, region: string) => {
  const bucketExists = await checkBucketExists(bucketName);

  if (!bucketExists) {
    console.log('S3 bucket does not exist. Creating...');
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
        ObjectOwnership: ObjectOwnership.ObjectWriter,
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
};

export const uploadDirectory = async (
  bucketName: string,
  directory: string
) => {
  const normalizedPath = normalize(directory);

  const files = await readRecursively(normalizedPath);

  await Promise.all(
    files.map(async (filePath) => {
      const s3Key = filePathToS3Key(filePath.replace(normalizedPath, ''));

      console.log(`Uploading ${s3Key} to ${bucketName}`);

      try {
        const fileBuffer = await fs.readFile(filePath);
        const mimeType = lookup(filePath) || 'application/octet-stream';

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileBuffer,
            ACL: 'public-read',
            ServerSideEncryption: 'AES256',
            ContentType: mimeType,
            CacheControl: getCacheControl(s3Key),
          })
        );
      } catch (error) {
        const e = error as S3ServiceException;
        const message = `Failed to upload ${s3Key}: ${e.name} - ${e.message}`;
        console.log(message);
        throw message;
      }
    })
  );
};

/**
 * Cache everything but index.html
 *
 * @param fileName
 */
const getCacheControl = (fileName: string) => {
  if (fileName === 'index.html') {
    return 'public, must-revalidate, proxy-revalidate, max-age=0';
  }
  return 'max-age=31536000';
};
