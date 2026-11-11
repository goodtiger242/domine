export const itemAsset = (id?: string | null) => id && /^0(6[1-9]|7[0-9]|80)$/.test(id) ? `/pet/catalog/${id}.webp` : null;
export function prepareImage(src: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (ready = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null; image.onerror = null;
      signal.removeEventListener("abort", cancel);
      resolve(ready);
    };
    const cancel = () => finish();
    const timer = setTimeout(finish, 4000);
    image.onload = () => { void image.decode().then(() => finish(true), cancel); };
    image.onerror = cancel;
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) finish(); else image.src = src;
  });
}
export function vibrate(pattern: number | number[]) {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) navigator.vibrate?.(pattern);
}
