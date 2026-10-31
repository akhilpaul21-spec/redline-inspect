export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T & { cancel(): void } {
  let scheduled = false;
  let lastArgs: any[] | null = null;
  let raf = 0;

  const wrapped = ((...args: any[]) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    raf = requestAnimationFrame(() => {
      scheduled = false;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    });
  }) as T & { cancel(): void };

  wrapped.cancel = () => {
    if (raf) cancelAnimationFrame(raf);
    scheduled = false;
    lastArgs = null;
  };

  return wrapped;
}
