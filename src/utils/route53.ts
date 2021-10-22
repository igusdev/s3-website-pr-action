import {
  ChangeResourceRecordSetsCommand,
  ListHostedZonesByNameCommand,
  ListResourceRecordSetsCommand,
  ListResourceRecordSetsCommandInput,
  ResourceRecordSet,
} from '@aws-sdk/client-route-53';
import { route53Client } from '../clients/aws';
import { cloudForntHostedZoneId, getAll } from './aws';

export const getHostedZone = async (domainName: string) => {
  console.info(`[route53] Looking for a hosted zone "${domainName}"...`);

  const { HostedZones: hostedZones } = await route53Client.send(
    new ListHostedZonesByNameCommand({})
  );

  const hostedZone = hostedZones?.find(
    (zone) => zone.Name === `${domainName}.`
  );

  if (!hostedZone) {
    console.info(`[route53] No hosted zone found`);
    return;
  }

  return hostedZone;
};

export const getRecord = async (hostedZoneId: string, domainName: string) => {
  const markerSplitOn = '/';
  const records = await getAll<ResourceRecordSet>(async (nextMarker, index) => {
    console.info(`[route53] Getting all records (page ${index})...`);

    const options: ListResourceRecordSetsCommandInput = {
      HostedZoneId: hostedZoneId,
    };

    if (nextMarker) {
      const markerSplit = nextMarker.split(markerSplitOn);
      options.StartRecordName = markerSplit[0];
      options.StartRecordType = markerSplit[1];
    }

    const { ResourceRecordSets, NextRecordName, NextRecordType } =
      await route53Client.send(new ListResourceRecordSetsCommand(options));

    return {
      items: ResourceRecordSets ?? [],
      nextMarker: NextRecordName
        ? [NextRecordName, NextRecordType].join(markerSplitOn)
        : undefined,
    };
  });

  return records.find(
    ({ Name, Type }) => Name === `${domainName}.` && Type === 'A'
  );
};

export const recordNeedsUpdate = async (
  hostedZoneId: string,
  domainName: string,
  cloudfrontDomainName: string
) => {
  console.info(`[route53] Looking for a matching record...`);

  const record = await getRecord(hostedZoneId, domainName);

  if (!record) {
    console.info(`[route53] No matching record found.`);
    return true;
  }

  const { AliasTarget } = record;
  if (
    AliasTarget &&
    AliasTarget.HostedZoneId === cloudForntHostedZoneId &&
    AliasTarget.DNSName === `${cloudfrontDomainName}.`
  ) {
    console.info(`[route53] Found 'A' record is properly configured.`);
    return false;
  }

  console.info(`[route53] Not properly configured 'A' record found.`);
  return true;
};

const modifyRecord = async (
  hostedZoneId: string,
  domainName: string,
  cloudfrontDomainName: string,
  action: 'UPSERT' | 'DELETE'
) => {
  await route53Client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: action,
            ResourceRecordSet: {
              Name: `${domainName}.`,
              AliasTarget: {
                HostedZoneId: cloudForntHostedZoneId,
                DNSName: `${cloudfrontDomainName}.`,
                EvaluateTargetHealth: false,
              },
              Type: 'A',
            },
          },
        ],
      },
    })
  );
};

export const createOrUpdateRecord = async (
  hostedZoneId: string,
  domainName: string,
  cloudfrontDomainName: string
) => {
  console.info(
    `[route53] Upserting A: "${domainName}" → ${cloudfrontDomainName}...`
  );
  await modifyRecord(hostedZoneId, domainName, cloudfrontDomainName, 'UPSERT');
};

export const removeRecord = async (
  hostedZoneId: string,
  domainName: string,
  cloudfrontDomainName: string
) => {
  console.info(
    `[route53] Deleting A: "${domainName}" → ${cloudfrontDomainName}...`
  );
  await modifyRecord(hostedZoneId, domainName, cloudfrontDomainName, 'DELETE');
};
