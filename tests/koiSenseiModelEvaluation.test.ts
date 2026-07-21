import { describe, expect, it } from 'vitest';

import {
  buildKoiSpokenText,
  evaluateKoiReplyText,
  normalizeKoiReplyText,
  parseKoiModelReply,
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

  it('joins every provider text block and detects a length-limited response', () => {
    expect(parseKoiModelReply({
      content: [
        { type: 'text', text: 'First sentence.' },
        { type: 'tool', text: 'ignored' },
        { type: 'text', text: 'Second sentence.' },
      ],
      stop_reason: 'max_tokens',
    })).toEqual({
      text: 'First sentence.\nSecond sentence.',
      stoppedForLength: true,
    });
  });

  it('accepts a provider response that ended normally', () => {
    expect(parseKoiModelReply({
      content: [{ type: 'text', text: 'Complete answer.' }],
      stop_reason: 'end_turn',
    })).toEqual({ text: 'Complete answer.', stoppedForLength: false });
  });

  it('ends shortened voice text on a complete sentence', () => {
    const firstSentence = `This is a complete explanation${' with detail'.repeat(8)}.`;
    const spokenText = buildKoiSpokenText(`${firstSentence} ${'More detail '.repeat(30)}`);
    expect(spokenText).toBe(firstSentence);
    expect(spokenText.length).toBeLessThanOrEqual(240);
  });
});
