import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;
}

describe('React Native renderer compatibility', () => {
  it('pins React and React DOM to the renderer version bundled by React Native', () => {
    const appPackage = readJson('package.json');
    const reactNativePackage = readJson('node_modules/react-native/package.json');
    const rendererVersion = String(reactNativePackage.peerDependencies.react).replace(/^[^\d]*/, '');

    expect(appPackage.dependencies.react).toBe(rendererVersion);
    expect(appPackage.dependencies['react-dom']).toBe(rendererVersion);
  });
});
