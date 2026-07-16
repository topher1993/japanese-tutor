import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.mts']);

/** Write an importer result only in a declared, parseable artifact format. */
export async function writeImportArtifact(output, payload, renderTypeScript) {
  const outputPath = resolve(output);
  const extension = extname(outputPath).toLowerCase();
  let contents;

  if (extension === '.json') {
    contents = `${JSON.stringify(payload, null, 2)}\n`;
  } else if (TYPESCRIPT_EXTENSIONS.has(extension)) {
    contents = renderTypeScript(payload);
  } else {
    throw new Error(`Unsupported output extension "${extension || '(none)'}". Use .json, .ts, or .mts.`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, contents, 'utf8');
}
