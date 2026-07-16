import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as ts from 'typescript';

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
      expect(JSON.parse(output).output).toMatch(/\.json$/);
    }
  });

  it('writes parseable TypeScript or JSON staging artifacts without touching app modules', () => {
    const directory = mkdtempSync(join(tmpdir(), 'japanese-tutor-import-contract-'));
    try {
      const jmdictInput = join(directory, 'JMdict_e.xml');
      const kanjidicInput = join(directory, 'kanjidic2.xml');
      writeFileSync(jmdictInput, `
        <JMdict><entry><ent_seq>1001</ent_seq><k_ele><keb>学校</keb></k_ele>
        <r_ele><reb>がっこう</reb></r_ele><sense><pos>noun</pos><gloss>school</gloss></sense></entry></JMdict>
      `, 'utf8');
      writeFileSync(kanjidicInput, `
        <kanjidic2><character><literal>学</literal><codepoint><cp_value cp_type="ucs">5B66</cp_value></codepoint>
        <misc><grade>1</grade><stroke_count>8</stroke_count></misc><reading_meaning><rmgroup>
        <reading r_type="ja_on">ガク</reading><reading r_type="ja_kun">まな.ぶ</reading><meaning>study</meaning>
        </rmgroup></reading_meaning></character></kanjidic2>
      `, 'utf8');

      const contracts = [
        {
          script: 'scripts/import-jmdict-vocab.mjs',
          input: jmdictInput,
          selector: ['--words', '学校'],
          exportName: 'importedJmdictVocabularyEntries',
          expectedValue: 'gakkou',
        },
        {
          script: 'scripts/import-kanjidic2.mjs',
          input: kanjidicInput,
          selector: ['--kanji', '学'],
          exportName: 'importedKanjidic2Entries',
          expectedValue: 'KANJIDIC2:5B66',
        },
      ];

      for (const [index, contract] of contracts.entries()) {
        const scriptPath = join(projectRoot, contract.script);
        const tsOutput = join(directory, `candidate-${index}.ts`);
        const jsonOutput = join(directory, `candidate-${index}.json`);
        for (const output of [tsOutput, jsonOutput]) {
          execFileSync('node', [scriptPath, '--input', contract.input, '--output', output, ...contract.selector], {
            cwd: projectRoot,
            encoding: 'utf8',
          });
        }

        const typeScriptSource = readFileSync(tsOutput, 'utf8');
        expect(typeScriptSource.trimStart().startsWith('{')).toBe(false);
        expect(typeScriptSource).toContain(`export const ${contract.exportName}`);
        expect(typeScriptSource).toContain(contract.expectedValue);
        const diagnostics = ts.transpileModule(typeScriptSource, {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
          reportDiagnostics: true,
        }).diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
        expect(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);

        const jsonArtifact = JSON.parse(readFileSync(jsonOutput, 'utf8')) as {
          schemaVersion: number;
          entries: unknown[];
        };
        expect(jsonArtifact.schemaVersion).toBe(1);
        expect(jsonArtifact.entries).toHaveLength(1);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('requires romanized reading evidence instead of accepting JMdict attribution as a pass', () => {
    const verifier = readFileSync(join(projectRoot, 'scripts/verify-japanese-phrases.py'), 'utf8');

    expect(verifier).toContain('romanize_reading(reading)');
    expect(verifier).toContain("'status': 'READING_UNVERIFIED'");
    expect(verifier).not.toContain('VERIFIED_KANJI_FUZZY');
  });
});
