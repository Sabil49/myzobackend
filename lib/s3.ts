// lib/s3.ts

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
const BUCKET_URL = process.env.AWS_S3_BUCKET_URL!;

interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload image to S3
 */
export async function uploadImageToS3(
  buffer: Buffer,
  mimetype: string,
  folder: string = 'products'
): Promise<UploadResult> {
  // Optimize image with sharp
  const optimizedBuffer = await sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Generate unique filename
  const filename = `${folder}/${uuidv4()}.jpg`;

  // Upload to S3 (without ACL)
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: optimizedBuffer,
    ContentType: 'image/jpeg',
    // ACL: 'public-read', // REMOVED - causes error
  });

  await s3Client.send(command);

  const url = `${BUCKET_URL}/${filename}`;

  return {
    url,
    key: filename,
  };
}

/**
 * Upload multiple images to S3
 */
export async function uploadMultipleImagesToS3(
  files: Array<{ buffer: Buffer; mimetype: string }>,
  folder: string = 'products'
): Promise<string[]> {
  const uploadPromises = files.map((file) =>
    uploadImageToS3(file.buffer, file.mimetype, folder)
  );

  const results = await Promise.all(uploadPromises);
  return results.map((result) => result.url);
}

/**
 * Delete image from S3
 */
export async function deleteImageFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Extract S3 key from URL
 */
export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  } catch {
    return null;
  }
}