export type DesktopOS = "windows" | "mac" | "linux";

/** The player's operating system, for setup instructions; Linux stands in for anything else and for SSR. */
export function detectOS(): DesktopOS {
  if (typeof navigator === "undefined") return "linux";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "mac";
  return "linux";
}

/** True inside the Tauri desktop app (checked at runtime; false during SSR). */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
}
