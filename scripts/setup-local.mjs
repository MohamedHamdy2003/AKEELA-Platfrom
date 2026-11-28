import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const template = await readFile(
  new URL('../apps/api/.env.example', import.meta.url),
  'utf8',
);
const content = template
  .replace(
    /^JWT_SECRET=\r?$/m,
    `JWT_SECRET=${randomBytes(48).toString('base64url')}`,
  )
  .replace(
    /^OTP_SECRET=\r?$/m,
    `OTP_SECRET=${randomBytes(48).toString('base64url')}`,
  );
if (
  !/^JWT_SECRET=.{32,}/m.test(content) ||
  !/^OTP_SECRET=.{32,}/m.test(content)
) {
  throw new Error('Could not populate JWT_SECRET and OTP_SECRET in template.');
}
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
