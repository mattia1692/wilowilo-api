import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'wilowilo-exercises';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY env vars');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const MOVEKIT_DIR = process.argv[2] || path.resolve(__dirname, '../../movekit');
const TMP_DIR = '/tmp/movekit-upload';

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch { return false; }
}

async function uploadFile(localPath: string, key: string, contentType: string) {
  const exists = await objectExists(key);
  if (exists) { console.log(`  skip ${key} (already exists)`); return; }

  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log(`  ✓ ${key} (${(body.length / 1024 / 1024).toFixed(1)}MB)`);
}

async function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const videosZip = path.join(MOVEKIT_DIR, 'full-library-NTRkdOevZfhYISO5pBWekIctpb7YNr.zip');
  const postersZip = path.join(MOVEKIT_DIR, 'full-library-posters.zip');

  if (!fs.existsSync(videosZip)) { console.error(`Videos zip not found: ${videosZip}`); process.exit(1); }
  if (!fs.existsSync(postersZip)) { console.error(`Posters zip not found: ${postersZip}`); process.exit(1); }

  const videosDir = path.join(TMP_DIR, 'videos');
  const postersDir = path.join(TMP_DIR, 'posters');

  if (!fs.existsSync(videosDir)) {
    console.log('Extracting videos...');
    fs.mkdirSync(videosDir, { recursive: true });
    execSync(`unzip -q -o "${videosZip}" -d "${videosDir}"`);
  }

  if (!fs.existsSync(postersDir)) {
    console.log('Extracting posters...');
    fs.mkdirSync(postersDir, { recursive: true });
    execSync(`unzip -q -o "${postersZip}" -d "${postersDir}"`);
  }

  const videoFiles = fs.readdirSync(videosDir).filter(f => f.endsWith('.mp4'));
  const posterBaseDir = fs.existsSync(path.join(postersDir, 'posters'))
    ? path.join(postersDir, 'posters')
    : postersDir;
  const posterFiles = fs.readdirSync(posterBaseDir).filter(f => f.endsWith('.webp'));

  console.log(`Found ${videoFiles.length} videos, ${posterFiles.length} posters`);

  console.log('\nUploading posters...');
  for (let i = 0; i < posterFiles.length; i++) {
    const file = posterFiles[i];
    const slug = file.replace('.webp', '');
    await uploadFile(path.join(posterBaseDir, file), `v1/posters/${slug}.webp`, 'image/webp');
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${posterFiles.length} posters done`);
  }

  console.log('\nUploading videos...');
  for (let i = 0; i < videoFiles.length; i++) {
    const file = videoFiles[i];
    const slug = file.replace('.mp4', '');
    await uploadFile(path.join(videosDir, file), `v1/videos/${slug}.mp4`, 'video/mp4');
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${videoFiles.length} videos done`);
  }

  console.log(`\nUpload complete: ${posterFiles.length} posters + ${videoFiles.length} videos`);
}

main().catch((e) => { console.error(e); process.exit(1); });
