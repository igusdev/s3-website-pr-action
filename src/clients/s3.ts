import { S3Client } from '@aws-sdk/client-s3';
import { region } from '../utils/aws';

export const s3Client = new S3Client({ region });
