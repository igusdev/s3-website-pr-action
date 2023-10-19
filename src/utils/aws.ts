import { BucketLocationConstraint } from '@aws-sdk/client-s3';

export type KnownRegion = Exclude<BucketLocationConstraint, 'EU'> | 'us-east-1';

/**
 * Copy of https://docs.aws.amazon.com/general/latest/gr/s3.html#s3_website_region_endpoints
 */
export const websiteEndpoint = {
  'af-south-1': 's3-website.af-south-1.amazonaws.com',
  'ap-east-1': 's3-website.ap-east-1.amazonaws.com',
  'ap-northeast-1': 's3-website-ap-northeast-1.amazonaws.com',
  'ap-northeast-2': 's3-website.ap-northeast-2.amazonaws.com',
  'ap-northeast-3': 's3-website.ap-northeast-3.amazonaws.com',
  'ap-south-1': 's3-website.ap-south-1.amazonaws.com',
  'ap-south-2': 's3-website.ap-south-2.amazonaws.com',
  'ap-southeast-1': 's3-website-ap-southeast-1.amazonaws.com',
  'ap-southeast-2': 's3-website-ap-southeast-2.amazonaws.com',
  'ap-southeast-3': 's3-website.ap-southeast-3.amazonaws.com',
  'ca-central-1': 's3-website.ca-central-1.amazonaws.com',
  'cn-north-1': 's3-website.cn-north-1.amazonaws.com.cn',
  'cn-northwest-1': 's3-website.cn-northwest-1.amazonaws.com.cn',
  'eu-central-1': 's3-website.eu-central-1.amazonaws.com',
  'eu-north-1': 's3-website.eu-north-1.amazonaws.com',
  'eu-south-1': 's3-website.eu-south-1.amazonaws.com',
  'eu-south-2': 's3-website.eu-south-2.amazonaws.com',
  'eu-west-1': 's3-website-eu-west-1.amazonaws.com',
  'eu-west-2': 's3-website.eu-west-2.amazonaws.com',
  'eu-west-3': 's3-website.eu-west-3.amazonaws.com',
  'me-south-1': 's3-website.me-south-1.amazonaws.com',
  'sa-east-1': 's3-website-sa-east-1.amazonaws.com',
  'us-east-1': 's3-website-us-east-1.amazonaws.com',
  'us-east-2': 's3-website.us-east-2.amazonaws.com',
  'us-gov-east-1': 's3-website.us-gov-east-1.amazonaws.com',
  'us-gov-west-1': 's3-website-us-gov-west-1.amazonaws.com',
  'us-west-1': 's3-website-us-west-1.amazonaws.com',
  'us-west-2': 's3-website-us-west-2.amazonaws.com',
} as const satisfies Record<KnownRegion, string>;

export const getAwsRegion = (): KnownRegion => {
  const region = process.env.AWS_REGION as string;
  if (!websiteEndpoint[region as keyof typeof websiteEndpoint]) {
    throw new Error(`Unknown region: ${region}`);
  }
  return region as KnownRegion;
};

export const setupAwsRegion = () => {
  if (!process.env.AWS_REGION) {
    process.env.AWS_REGION = 'us-east-1';
  }
};
