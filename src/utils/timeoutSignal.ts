/**
 * Cross-browser safe AbortSignal timeout helper.
 * Prevents "AbortSignal.timeout is not a function" or constructor crashes
 * on WebKit/Safari, older iOS devices, and sandboxed iframes.
 */
export function safeTimeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
      return (AbortSignal as any).timeout(ms);
    }
  } catch {}

  try {
    if (typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      setTimeout(() => {
        try {
          controller.abort();
        } catch {}
      }, ms);
      return controller.signal;
    }
  } catch {}

  return undefined;
}
