declare function gtag(command: string, ...args: any[]): void;

export function trackEvent(action: string, params?: Record<string, any>): void {
  try {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, params);
    }
  } catch {
    // ignore
  }
}
