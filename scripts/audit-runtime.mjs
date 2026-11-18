import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const exception = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const expires = '2026-12-18T23:59:59Z';
export function reviewAudit(report, now = new Date()) {
  if (!report.vulnerabilities || !report.metadata || report.error)
    throw new Error('Invalid npm audit report; refusing to pass.');
  const findings = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    for (const source of vulnerability.via) {
      if (typeof source === 'string') {
        if (!report.vulnerabilities[source])
          throw new Error('Unresolved audit dependency.');
        continue;
      }
      if (['moderate', 'high', 'critical'].includes(source.severity))
        findings.set(source.url, source);
    }
  }
  const blocked = [...findings.values()].filter(
    (source) => source.url !== exception || now > new Date(expires),
  );
  return {
    blocked,
    accepted:
      findings.has(exception) &&
      !blocked.some((source) => source.url === exception),
    expires,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (!process.env.npm_execpath)
      throw new Error('Run npm run audit:runtime.');
    const result = spawnSync(
      process.execPath,
      [process.env.npm_execpath, 'audit', '--omit=dev', '--json'],
      { encoding: 'utf8', timeout: 120000 },
    );
    if (result.error || result.signal)
      throw new Error('npm audit did not complete.');
    const review = reviewAudit(JSON.parse(result.stdout));
    if (review.accepted)
      console.log(
        `Owner-approved temporary exception: ${exception}; expires ${expires}. See docs/SECURITY.md.`,
      );
    for (const finding of review.blocked)
      console.error(`${finding.severity}: ${finding.name} ${finding.url}`);
    if (review.blocked.length) process.exitCode = 1;
    else
      console.log(
        'Runtime audit passed the approved policy; no other moderate/high/critical advisories.',
      );
  } catch {
    console.error('Runtime audit failed or returned an unreadable report.');
    process.exitCode = 1;
  }
}
