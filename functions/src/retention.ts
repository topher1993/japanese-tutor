import { Timestamp, type Firestore, type Query } from 'firebase-admin/firestore';

export const KOI_RETENTION_DELETE_BATCH_LIMIT = 450;
export const KOI_RETENTION_MAX_BATCHES_PER_COLLECTION = 20;

export async function deleteExpiredInBatches(
  query: Query,
  field: string,
  now: Timestamp,
  maxBatches = KOI_RETENTION_MAX_BATCHES_PER_COLLECTION,
): Promise<{ deleted: number; hasMore: boolean }> {
  let deleted = 0;
  for (let batchNumber = 0; batchNumber < maxBatches; batchNumber += 1) {
    const snapshot = await query
      .where(field, '<=', now)
      .limit(KOI_RETENTION_DELETE_BATCH_LIMIT)
      .get();
    if (snapshot.empty) return { deleted, hasMore: false };
    const batch = snapshot.docs[0].ref.firestore.batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < KOI_RETENTION_DELETE_BATCH_LIMIT) return { deleted, hasMore: false };
  }
  // Bound each scheduled invocation. A true value is a continuation marker;
  // the next scheduled run resumes from the still-expired query head.
  return { deleted, hasMore: true };
}

export async function enforceKoiRetention(db: Firestore, nowMs: number): Promise<{
  messagesDeleted: number;
  requestsDeleted: number;
  ttsRequestsDeleted: number;
  reportsDeleted: number;
  continuationRequired: boolean;
}> {
  const now = Timestamp.fromMillis(nowMs);
  const [messages, requests, ttsRequests, reports] = await Promise.all([
    deleteExpiredInBatches(db.collectionGroup('koiMessages'), 'expiresAt', now),
    deleteExpiredInBatches(db.collectionGroup('koiRequests'), 'retentionExpiresAt', now),
    deleteExpiredInBatches(db.collectionGroup('koiTtsRequests'), 'retentionExpiresAt', now),
    deleteExpiredInBatches(db.collectionGroup('koiReports'), 'expiresAt', now),
  ]);
  return {
    messagesDeleted: messages.deleted,
    requestsDeleted: requests.deleted,
    ttsRequestsDeleted: ttsRequests.deleted,
    reportsDeleted: reports.deleted,
    continuationRequired: [messages, requests, ttsRequests, reports].some((result) => result.hasMore),
  };
}
