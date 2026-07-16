import { readFileSync } from 'node:fs';

import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadString } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

const projectId = 'demo-koi-sensei';
const readRepositoryFile = (name: string): string => readFileSync(
  new URL(`../../${name}`, import.meta.url),
  'utf8',
);

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readRepositoryFile('firestore.rules') },
    storage: { rules: readRepositoryFile('storage.rules') },
  });
});

afterAll(async () => {
  await environment.cleanup();
});

const contexts = (): Array<[string, RulesTestContext]> => [
  ['unauthenticated', environment.unauthenticatedContext()],
  ['authenticated', environment.authenticatedContext('learner-1', {
    email: 'learner@example.test',
    email_verified: true,
  })],
];

describe('Firestore default-deny rules in the emulator', () => {
  it.each(['unauthenticated', 'authenticated'])('denies %s client reads and writes', async (identity) => {
    const context = contexts().find(([name]) => name === identity)?.[1];
    if (!context) throw new Error(`Missing ${identity} test context`);
    const privateDocument = doc(context.firestore(), 'koiUsers', 'learner-1');
    await assertFails(getDoc(privateDocument));
    await assertFails(setDoc(privateDocument, { shouldNeverReachServer: true }));
  });
});

describe('Storage default-deny rules in the emulator', () => {
  it.each(['unauthenticated', 'authenticated'])('denies %s client downloads and uploads', async (identity) => {
    const context = contexts().find(([name]) => name === identity)?.[1];
    if (!context) throw new Error(`Missing ${identity} test context`);
    const privateObject = ref(context.storage(), 'koi/private-audio-must-not-exist.txt');
    await assertFails(getBytes(privateObject));
    await assertFails(uploadString(privateObject, 'raw audio is never accepted'));
  });
});

