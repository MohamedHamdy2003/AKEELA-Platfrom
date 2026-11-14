import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { setTimeout } from 'node:timers';
const project = `akeela-smoke-${randomUUID()}`;
const image = process.env.SMOKE_IMAGE ?? 'akeela-api:smoke';
const env = { ...process.env, SMOKE_IMAGE: image };
const args = ['compose', '-p', project, '-f', 'deploy/compose.smoke.yml'];
function docker(extra, capture = false) {
  return execFileSync('docker', [...args, ...extra], {
    env,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    timeout: 240000,
  });
}
function get(url, ca) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { ca, family: 4 }, (res) => {
      let body = [];
      res.on('data', (c) => body.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(body),
        }),
      );
    });
    req.setTimeout(10000, () => req.destroy(new Error('Smoke HTTP timeout')));
    req.on('error', reject);
  });
}
async function retry(work) {
  let last;
  for (let i = 0; i < 40; i++) {
    try {
      return await work();
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw last;
}
try {
  if (process.env.SMOKE_SKIP_BUILD !== 'true')
    execFileSync(
      'docker',
      ['build', '-f', 'apps/api/Dockerfile', '-t', image, '.'],
      {
        stdio: 'inherit',
        timeout: 600000,
      },
    );
  docker(['up', '-d', '--wait', '--wait-timeout', '90', 'postgres']);
  docker([
    'run',
    '--rm',
    '--no-deps',
    'api',
    'npm',
    'run',
    'migration:run:prod',
  ]);
  docker(['up', '-d', '--wait', '--wait-timeout', '90', 'api']);
  for (const config of [
    '/etc/caddy/Caddyfile.production',
    '/etc/caddy/templates/frontends.caddy',
  ])
    docker([
      'run',
      '--rm',
      '--no-deps',
      'caddy',
      'caddy',
      'validate',
      '--config',
      config,
      '--adapter',
      'caddyfile',
    ]);
  docker([
    'run',
    '--rm',
    '--no-deps',
    'caddy',
    'caddy',
    'validate',
    '--config',
    '/etc/caddy/Caddyfile',
  ]);
  docker(['up', '-d', 'caddy']);
  const port = docker(['port', 'caddy', '443'], true).trim().split(':').pop();
  const httpPort = docker(['port', 'caddy', '80'], true)
    .trim()
    .split(':')
    .pop();
  const ca = await retry(() =>
    docker(
      [
        'exec',
        '-T',
        'caddy',
        'cat',
        '/data/caddy/pki/authorities/local/root.crt',
      ],
      true,
    ),
  );
  const base = `https://localhost:${port}`;
  await retry(async () => {
    const r = await get(`${base}/api/v1/health/ready`, ca);
    if (r.status !== 200) throw Error('Readiness failed');
  });
  const redirect = await get(`http://localhost:${httpPort}/api/v1/health/live`);
  if (
    redirect.status !== 308 ||
    !redirect.headers.location?.startsWith('https://')
  )
    throw Error('HTTPS redirect failed');
  const filename = `${randomUUID()}.webp`;
  docker([
    'exec',
    '-T',
    'api',
    'node',
    '-e',
    `require('sharp')({create:{width:2,height:2,channels:3,background:'red'}}).webp().toFile('/app/storage/images/${filename}').catch(()=>process.exit(1))`,
  ]);
  const first = await get(`${base}/images/${filename}`, ca);
  if (
    first.status !== 200 ||
    !first.headers['content-type']?.startsWith('image/webp')
  )
    throw Error('Image serving failed');
  docker([
    'up',
    '-d',
    '--no-deps',
    '--force-recreate',
    '--wait',
    '--wait-timeout',
    '90',
    'api',
  ]);
  await retry(async () => {
    if ((await get(`${base}/api/v1/health/ready`, ca)).status !== 200)
      throw Error('Recreated API failed');
  });
  const second = await get(`${base}/images/${filename}`, ca);
  if (second.status !== 200 || !first.body.equals(second.body))
    throw Error('Image persistence failed');
  console.log(
    'Smoke passed: trusted local TLS, HTTP redirect, proxy readiness, public images and persistence after API recreation.',
  );
} finally {
  // Only the random, test-only project created by this process is removed.
  if (/^akeela-smoke-[0-9a-f-]{36}$/.test(project))
    docker(['down', '--volumes', '--remove-orphans']);
}
