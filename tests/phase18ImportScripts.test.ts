import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const projectRoot = process.cwd();

describe('Phase 18 import scripts', () => {
  it('provides repeatable JMdict and KANJIDIC2 import scripts with dry-run mode', () => {
    const scripts = ['scripts/import-jmdict-vocab.mjs', 'scripts/import-kanjidic2.mjs'];

    for (const script of scripts) {
      const scriptPath = join(projectRoot, script);
      expect(existsSync(scriptPath)).toBe(true);

      const output = execFileSync('node', [scriptPath, '--dry-run'], {
        cwd: projectRoot,
        encoding: 'utf8',
      });

      expect(output).toContain('source');
      expect(output).toContain('license');
      expect(output).toContain('output');
    }
  });
});
