declare function gtag(command: string, ...args: (string | number | boolean | Record<string, string | number | boolean>)[]): void;

export function trackEvent(action: string, params?: Record<string, string | number | boolean>): void {
  try {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, params ?? {});
    }
  } catch {
    // ignore
  }
}
