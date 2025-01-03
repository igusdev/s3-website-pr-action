import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';

const maxSockets = 500;
const keepAlive = true;

export const s3Client = new S3Client({
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5_000,
    socketTimeout: 120_000,
    httpAgent: new HttpAgent({ maxSockets, keepAlive }),
    httpsAgent: new HttpsAgent({ maxSockets, keepAlive }),
  }),
});
