import { getInput, setFailed } from '@actions/core';
import { context } from '@actions/github';
import { prClosed } from './actions/pr-closed';
import { prUpdated } from './actions/pr-updated';
import { setupAwsRegion } from './utils/aws';

const main = async () => {
  setupAwsRegion();

  try {
    const bucketPrefix = getInput('bucket-prefix').toLowerCase();
    const environmentPrefix = getInput('environment-prefix').toLowerCase();
    const domainName = getInput('domain-name') || undefined;

    const prNumber = context.payload.pull_request?.number;
    const bucketName = `${bucketPrefix}-pr${prNumber}`;

    console.log(`Bucket Name: ${bucketName}`);

    const githubActionType = context.payload.action;

    if (context.eventName === 'pull_request') {
      switch (githubActionType) {
        case 'opened':
        case 'reopened':
        case 'synchronize': {
          const folderToCopy = getInput('folder-to-copy');
          await prUpdated(
            bucketName,
            folderToCopy,
            environmentPrefix,
            domainName
          );
          break;
        }
        case 'closed':
          await prClosed(bucketName, environmentPrefix, domainName);
          break;

        default:
          console.log('PR not created, modified or deleted. Skipping...');
          break;
      }
    } else {
      console.log('Not a PR. Skipping...');
    }
  } catch (error) {
    console.log(error);
    setFailed(error as Error);
  }
};

main();
