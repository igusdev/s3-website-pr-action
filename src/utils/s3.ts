import { HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { SdkError } from '@aws-sdk/types';
import { promises as fs } from 'fs';
import { lookup } from 'mime-types';
import { normalize } from 'path';
import readdir from 'recursive-readdir';
import { s3Client } from '../clients/s3';

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

export const uploadDirectory = async (
  bucketName: string,
  directory: string
) => {
  const normalizedPath = normalize(directory);

  const files = await readdir(normalizedPath);

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
        const e = error as SdkError;
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
