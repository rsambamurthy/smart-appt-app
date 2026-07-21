import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET = process.env.S3_BUCKET!;
export const SIGNED_URL_EXPIRY = parseInt(process.env.S3_SIGNED_URL_EXPIRY ?? '900', 10);

export const getSignedDownloadUrl = async (s3Key: string): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_EXPIRY });
};

export const deleteS3Object = async (s3Key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
};

/** Build a structured S3 key for different upload types */
export const buildS3Key = (
  type: 'maintenance' | 'invoice' | 'receipt' | 'document' | 'profile',
  associationId: string,
  filename: string,
): string => `${associationId}/${type}/${Date.now()}-${filename}`;
