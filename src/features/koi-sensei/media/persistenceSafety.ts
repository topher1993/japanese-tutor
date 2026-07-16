const RAW_AUDIO_FIELD_NAMES = new Set([
  'rawaudio',
  'audiobytes',
  'audiodata',
  'audiobase64',
  'audioblob',
  'audiobuffer',
  'audiouri',
  'audiourl',
  'recordinguri',
  'recordingurl',
  'recordingpath',
  'pcm',
  'pcmsamples',
  'waveform',
]);

function normalizedFieldName(value: string): string {
  return value.replace(/[^a-z0-9]/giu, '').toLowerCase();
}

function isBinaryPayload(value: unknown): boolean {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return true;
  return Object.prototype.toString.call(value) === '[object Blob]';
}

/**
 * Audits a value immediately before persistence or analytics. Koi may play
 * ephemeral provider audio, but binary audio, recording paths, and encoded
 * audio must never enter local storage, Firestore, logs, or analytics.
 */
export function auditKoiMediaPersistence(value: unknown): {
  safe: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (candidate: unknown, path: string): void => {
    if (isBinaryPayload(candidate)) {
      violations.push(`${path}:binary-payload`);
      return;
    }
    if (candidate === null || typeof candidate !== 'object') return;
    if (seen.has(candidate)) return;
    seen.add(candidate);

    if (Array.isArray(candidate)) {
      candidate.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }

    for (const [key, entry] of Object.entries(candidate)) {
      const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
      if (RAW_AUDIO_FIELD_NAMES.has(normalizedFieldName(key))) {
        violations.push(`${childPath}:raw-audio-field`);
        continue;
      }
      visit(entry, childPath);
    }
  };

  visit(value, '$');
  return { safe: violations.length === 0, violations };
}
