export function createAppSearchParams(runtimeWindow: Window | undefined = typeof window !== 'undefined' ? window : undefined): URLSearchParams {
  const search = runtimeWindow?.location?.search;
  return new URLSearchParams(typeof search === 'string' ? search : '');
}
