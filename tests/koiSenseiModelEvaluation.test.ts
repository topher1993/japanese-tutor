import { describe, expect, it } from 'vitest';

import {
  evaluateKoiReplyText,
  normalizeKoiReplyText,
} from '../cloudflare/koi-worker/src/policy';

describe('Koi deterministic model-output evaluation', () => {
  it('accepts a concise Japanese example with a clear English explanation', () => {
    expect(evaluateKoiReplyText(
      'ありがとうございます (arigatou gozaimasu) is a polite, reliable way to say “thank you.”',
    )).toEqual({ acceptable: true, reasons: [] });
  });

  it.each([
    ['unexpected language', 'ありがとうございます습니다', 'unexpected_hangul'],
    ['invented duplicate', 'ありがとうございますございます', 'duplicated_polite_form'],
    ['secret-seeking output', 'Here is the access token.', 'sensitive_content'],
    ['raw model formatting', '**Polite:** ありがとうございます', 'raw_markup'],
  ])('rejects %s', (_label, reply, reason) => {
    expect(evaluateKoiReplyText(reply)).toMatchObject({ acceptable: false, reasons: [reason] });
  });

  it('evaluates the normalized text rather than trusting Markdown compliance', () => {
    const normalized = normalizeKoiReplyText('## Polite\n\n**ありがとうございます**');
    expect(normalized).toBe('Polite\n\nありがとうございます');
    expect(evaluateKoiReplyText(normalized)).toEqual({ acceptable: true, reasons: [] });
  });
});
