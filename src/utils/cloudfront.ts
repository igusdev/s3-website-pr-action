import {
  CreateDistributionCommand,
  DeleteDistributionCommand,
  Distribution,
  DistributionConfig,
  DistributionSummary,
  GetDistributionCommand,
  ListDistributionsCommand,
  UpdateDistributionCommand,
  waitUntilDistributionDeployed,
} from '@aws-sdk/client-cloudfront';
import { cloudFrontClient } from '../clients/aws';
import { getAll } from './aws';

export interface DistributionDetails {
  Id: Distribution['Id'];
  ARN: Distribution['ARN'];
  DomainName: Distribution['DomainName'];
}

const getDistributionSummary = async (domainName: string) => {
  const distributions = await getAll<DistributionSummary>(
    async (nextMarker, index) => {
      console.info(`[CloudFront] Getting all distributions (page ${index})...`);

      const { DistributionList } = await cloudFrontClient.send(
        new ListDistributionsCommand({ Marker: nextMarker })
      );

      if (!DistributionList) {
        return { items: [], nextMarker: undefined };
      }

      return {
        items: DistributionList.Items ?? [],
        nextMarker: DistributionList.NextMarker,
      };
    }
  );

  return distributions.find((dist) =>
    dist.Aliases?.Items?.includes(domainName)
  );
};

export const getDeployedCloudfrontDistribution = async (
  domainName: string
): Promise<DistributionDetails | undefined> => {
  const distribution = await getDistributionSummary(domainName);

  if (!distribution) {
    console.info(`[CloudFront] No matching distribution found.`);
    return;
  }

  console.info(`[CloudFront] Distribution found: ${distribution.Id}`);

  if (['InProgress', 'In Progress'].includes(distribution.Status ?? '')) {
    console.info(
      `[CloudFront] Waiting for distribution to be deployed. This step might takes up to 25 minutes...`
    );

    await waitUntilDistributionDeployed(
      { client: cloudFrontClient, maxWaitTime: 25 * 60 * 1000 },
      { Id: distribution.Id }
    );
  }

  return distribution;
};

export const getCloudfrontDistributionDetails = async (
  domainName: string
): Promise<Distribution | undefined> => {
  const distributionSummary = await getDistributionSummary(domainName);

  if (!distributionSummary) {
    console.info(`[CloudFront] No matching distribution found.`);
    return;
  }

  const { Distribution: distribution } = await cloudFrontClient.send(
    new GetDistributionCommand({
      Id: distributionSummary.Id,
    })
  );

  if (!distribution) {
    console.info(`[CloudFront] No matching distribution found.`);
    return;
  }

  console.info(`[CloudFront] Distribution found: ${distribution.Id}`);
  return distribution;
};

export const createCloudFrontDistribution = async (
  domainName: string,
  bucketDomainName: string,
  sslCertificateARN: string
): Promise<DistributionDetails> => {
  console.info(
    `[CloudFront] Creating Cloudfront distribution with origin "${bucketDomainName}"...`
  );

  const { Distribution } = await cloudFrontClient.send(
    new CreateDistributionCommand({
      DistributionConfig: getDistributionConfig(
        domainName,
        bucketDomainName,
        sslCertificateARN
      ),
    })
  );

  if (!Distribution) {
    throw new Error('[CloudFront] Could not create distribution.');
  }

  console.info(
    `[CloudFront] Waiting for distribution to be available. This step might takes up to 25 minutes...`
  );
  await waitUntilDistributionDeployed(
    { client: cloudFrontClient, maxWaitTime: 25 * 60 * 1000 },
    { Id: Distribution.Id }
  );

  return Distribution;
};

export const deactivateCloudFrontDistribution = async (
  distribution: Distribution
): Promise<void> => {
  console.info(
    `[CloudFront] Deactivating Cloudfront distribution "${distribution.Id}"...`
  );

  const config: DistributionConfig = {
    ...(distribution.DistributionConfig as DistributionConfig),
    Enabled: false,
  };

  await cloudFrontClient.send(
    new UpdateDistributionCommand({
      Id: distribution.Id,
      DistributionConfig: config,
    })
  );

  console.info(
    `[CloudFront] Waiting for distribution to be deployed. This step might takes up to 25 minutes...`
  );
  await waitUntilDistributionDeployed(
    { client: cloudFrontClient, maxWaitTime: 25 * 60 * 1000 },
    { Id: distribution.Id }
  );

  return;
};

export const deleteCloudFrontDistribution = async (
  distributionId: string
): Promise<void> => {
  console.info(
    `[CloudFront] Deleting Cloudfront distribution "${distributionId}"...`
  );

  await cloudFrontClient.send(
    new DeleteDistributionCommand({ Id: distributionId })
  );
};

const getDistributionConfig = (
  domainName: string,
  bucketDomainName: string,
  sslCertificateARN: string
): DistributionConfig => ({
  CallerReference: Date.now().toString(),
  Aliases: {
    Quantity: 1,
    Items: [domainName],
  },
  Origins: {
    Quantity: 1,
    Items: [
      {
        Id: bucketDomainName,
        DomainName: bucketDomainName,
        CustomOriginConfig: {
          HTTPPort: 80,
          HTTPSPort: 443,
          OriginProtocolPolicy: 'http-only',
          OriginSslProtocols: {
            Quantity: 1,
            Items: ['TLSv1'],
          },
          OriginReadTimeout: 30,
          OriginKeepaliveTimeout: 5,
        },
        CustomHeaders: {
          Quantity: 0,
          Items: [],
        },
        OriginPath: '',
      },
    ],
  },
  Enabled: true,
  Comment: '',
  PriceClass: 'PriceClass_All',
  Logging: {
    Enabled: false,
    IncludeCookies: false,
    Bucket: '',
    Prefix: '',
  },
  CacheBehaviors: {
    Quantity: 0,
  },
  CustomErrorResponses: {
    Quantity: 0,
  },
  Restrictions: {
    GeoRestriction: {
      RestrictionType: 'none',
      Quantity: 0,
    },
  },
  DefaultRootObject: 'index.html',
  WebACLId: '',
  HttpVersion: 'http2',
  DefaultCacheBehavior: {
    ViewerProtocolPolicy: 'redirect-to-https',
    TargetOriginId: bucketDomainName,
    ForwardedValues: {
      QueryString: false,
      Cookies: {
        Forward: 'none',
      },
      Headers: {
        Quantity: 0,
        Items: [],
      },
      QueryStringCacheKeys: {
        Quantity: 0,
        Items: [],
      },
    },
    AllowedMethods: {
      Quantity: 3,
      Items: ['HEAD', 'GET', 'OPTIONS'],
      CachedMethods: {
        Quantity: 2,
        Items: ['HEAD', 'GET'],
      },
    },
    TrustedSigners: {
      Enabled: false,
      Quantity: 0,
    },
    MinTTL: 0,
    DefaultTTL: 86400,
    MaxTTL: 31536000,
    FieldLevelEncryptionId: '',
    LambdaFunctionAssociations: {
      Quantity: 0,
      Items: [],
    },
    SmoothStreaming: false,
    Compress: true,
  },
  ViewerCertificate: {
    ACMCertificateArn: sslCertificateARN,
    SSLSupportMethod: 'sni-only',
    MinimumProtocolVersion: 'TLSv1.2_2021',
    CertificateSource: 'acm',
  },
});
