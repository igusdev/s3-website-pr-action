import {
  CertificateStatus,
  CertificateSummary,
  ListCertificatesCommand,
} from '@aws-sdk/client-acm';
import { acmClient } from '../clients/aws';
import { getAll } from './aws';

export const getCertificateARN = async (domainName: string) => {
  const certificates = await getAll<CertificateSummary>(
    async (nextMarker, index) => {
      console.info(`[ACM] Geting all issued certificates (page ${index})...`);
      const { CertificateSummaryList, NextToken } = await acmClient.send(
        new ListCertificatesCommand({
          CertificateStatuses: [CertificateStatus.ISSUED],
          NextToken: nextMarker,
        })
      );

      return { items: CertificateSummaryList ?? [], nextMarker: NextToken };
    }
  );

  const certificate = certificates.find(
    (certificate) =>
      certificate.DomainName === domainName && !!certificate.CertificateArn
  );

  if (!certificate) {
    console.log(`[ACM] No certificate found for domain ${domainName}`);
    return;
  }

  console.info(`[ACM] Found certificate for "${domainName}".`);
  return certificate.CertificateArn;
};
