/**
 * Phase 25 / P3-1 — Audit log entry shape.
 *
 * The audit log captures who-did-what-when for capability-level actions
 * (settings reset, SRS review, lesson start, quiz submit, etc.). Every
 * entry must carry all four fields so renderers can produce stable
 * structured output instead of falling back to "[object Object]".
 *
 * The renderer lives at src/services/auditLog.ts and is the single
 * canonical way to convert an AuditEntry to display text.
 */
export interface AuditEntry {
  /** Verb in past tense — e.g. `reviewed_flashcard`, `reset_progress`. */
  action: string;
  /** Capability path invoked — e.g. `srs.persist`, `settings.reset`. */
  capability: string;
  /** Identity of the actor — e.g. `user:tophe`, `system:boot`. */
  actor: string;
  /** ISO-8601 timestamp string. */
  timestamp: string;
}