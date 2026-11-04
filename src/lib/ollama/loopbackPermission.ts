// Chrome and Edge (142+) ask the player before a public page may reach a program
// on their own machine, which is what talking to Ollama at localhost is. The prompt
// fires on the first connection attempt, so the web build must not probe on page
// load unless the player has already allowed it. Firefox has no such prompt and
// reports "unsupported" here, as does the desktop proxy path.

export type LoopbackPermission = "granted" | "denied" | "prompt" | "unsupported";

/** Whether this page may currently reach localhost, without triggering the prompt. */
export async function queryLoopbackPermission(): Promise<LoopbackPermission> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unsupported";
  try {
    // Chrome 145+ names the loopback grant separately; the older "local-network-access"
    // name is a legacy alias and crashes some versions, so it is never queried.
    const status = await navigator.permissions.query({ name: "loopback-network" as PermissionName });
    return status.state;
  } catch {
    // The browser doesn't know the permission, so it never asks for it.
    return "unsupported";
  }
}

/** A page served from the machine itself needs no permission to reach it. */
export function pageIsLoopback(): boolean {
  if (typeof location === "undefined") return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}
