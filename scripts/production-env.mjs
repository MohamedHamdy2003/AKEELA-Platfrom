const header = '# PRIVATE production configuration. Never commit or print.\n';
export function parsePrivateEnvironment(content, parse) {
  const values = parse(content);
  // dotenv retains Compose's escaped apostrophes in single-quoted values.
  // Decode only our own rendered format; leave owner-authored dotenv files alone.
  if (
    content
      .replace(/^\uFEFF/, '')
      .replaceAll('\r\n', '\n')
      .startsWith(header)
  )
    for (const key of Object.keys(values))
      values[key] = values[key].replaceAll("\\'", "'");
  return values;
}
export function renderPrivateEnvironment(values) {
  if (
    Object.entries(values).some(
      ([key, value]) =>
        !/^[_A-Z][_A-Z0-9]*$/.test(key) || /[\r\n\0]/.test(value),
    )
  )
    throw new Error('Invalid single-line environment fields.');
  return (
    header +
    Object.entries(values)
      .map(([key, value]) => `${key}='${value.replaceAll("'", "\\'")}'`)
      .join('\n') +
    '\n'
  );
}
