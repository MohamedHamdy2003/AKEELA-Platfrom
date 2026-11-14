import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Unknown paths and shared tooling are checked conservatively. Frontend apps
// receive their own CI/release jobs when their implementation is authorized.
export function apiAffected(paths) {
  return paths.some((file) => {
    const path = file.replaceAll('\\', '/');
    return !(
      path.startsWith('docs/') ||
      /^apps\/(admin|restaurant|delivery)\//.test(path) ||
      /^AKEELA-[^/]+\.md$/.test(path) ||
      path === 'README.md' ||
      path.startsWith('bruno/')
    );
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const base = process.env.BASE_SHA ?? '';
  const head = process.env.HEAD_SHA ?? 'HEAD';
  let affected = true;
  if (/^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base)) {
    try {
      const files = execFileSync(
        'git',
        ['diff', '--name-only', '-z', base, head],
        {
          encoding: 'utf8',
        },
      )
        .split('\0')
        .filter(Boolean);
      affected = apiAffected(files);
    } catch {
      // Missing history must never silently skip API validation/publication.
      affected = true;
    }
  }
  const result = `api=${affected}\n`;
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, result);
  process.stdout.write(result);
}
