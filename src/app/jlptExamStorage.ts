import {
  createJlptExamAttemptRepository,
  type JlptExamAttemptRepository,
} from '../repositories/jlptExamAttemptRepository';
import { openOnboardingStorage } from './onboardingStorage';

let sharedRepository: JlptExamAttemptRepository | null = null;

/**
 * The exam flow uses the same durable key/value store as onboarding and
 * navigation. The small deferred adapter keeps repository creation
 * synchronous while preserving the shared native SQLite/web storage boot.
 */
export function getJlptExamAttemptRepository(): JlptExamAttemptRepository {
  if (sharedRepository) return sharedRepository;
  sharedRepository = createJlptExamAttemptRepository({
    async getItem(key) {
      return (await openOnboardingStorage()).getItem(key);
    },
    async setItem(key, value) {
      await (await openOnboardingStorage()).setItem(key, value);
    },
    async removeItem(key) {
      await (await openOnboardingStorage()).removeItem(key);
    },
  });
  return sharedRepository;
}
