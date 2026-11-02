/** True inside the Tauri desktop app (checked at runtime; false during SSR). */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
}
