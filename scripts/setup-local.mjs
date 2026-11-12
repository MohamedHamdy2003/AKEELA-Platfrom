import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const template = await readFile('.env.example', 'utf8');
const content = template
  .replace(
    'JWT_SECRET=\n',
    `JWT_SECRET=${randomBytes(48).toString('base64url')}\n`,
  )
  .replace(
    'OTP_SECRET=\n',
    `OTP_SECRET=${randomBytes(48).toString('base64url')}\n`,
  );
try {
  await writeFile('.env', content, { flag: 'wx', mode: 0o600 });
  console.log('Created ignored local .env with independent random secrets.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env already exists; left unchanged.');
}
