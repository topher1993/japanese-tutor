export interface ResetAllDeviceDataDependencies {
  resetLearning(): Promise<{ srsRowsCleared: number }>;
  resetProfile(): Promise<{ profileRowsCleared: number }>;
  resetKoi(): Promise<void>;
  resetAppOwnedData(): Promise<void> | void;
}

export interface ResetAllDeviceDataResult {
  srsRowsCleared: number;
  profileRowsCleared: number;
}

type Settled<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

async function settle<T>(operation: () => Promise<T> | T): Promise<Settled<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Coordinates the app-wide shared-device reset. Learning is attempted first
 * so its live progress subscription observes an empty snapshot before Koi is
 * cleared. Every remaining store is still attempted even when one reset fails.
 */
export async function resetAllDeviceData(
  dependencies: ResetAllDeviceDataDependencies,
): Promise<ResetAllDeviceDataResult> {
  const learning = await settle(dependencies.resetLearning);
  const [profile, koi, appOwned] = await Promise.all([
    settle(dependencies.resetProfile),
    settle(dependencies.resetKoi),
    settle(dependencies.resetAppOwnedData),
  ]);
  if (!learning.ok || !profile.ok || !koi.ok || !appOwned.ok) {
    throw new Error('One or more local data stores could not be reset.');
  }
  return {
    srsRowsCleared: learning.value.srsRowsCleared,
    profileRowsCleared: profile.value.profileRowsCleared,
  };
}
