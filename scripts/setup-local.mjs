import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const template = await readFile(
  new URL('../apps/api/.env.example', import.meta.url),
  'utf8',
);
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
  await writeFile(new URL('../apps/api/.env', import.meta.url), content, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('Created ignored apps/api/.env with independent random secrets.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log(
    `${fileURLToPath(new URL('../apps/api/.env', import.meta.url))} already exists; left unchanged.`,
  );
}
