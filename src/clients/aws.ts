import { ACMClient } from '@aws-sdk/client-acm';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import { Route53Client } from '@aws-sdk/client-route-53';
import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({});
export const route53Client = new Route53Client({});
export const cloudFrontClient = new CloudFrontClient({});
// CloudFront certificates must be in us-east-1 according to AWS docs
export const acmClient = new ACMClient({ region: 'us-east-1' });
