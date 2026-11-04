import { afterEach, describe, expect, it } from "vitest";
import { pageIsLoopback, queryLoopbackPermission } from "./loopbackPermission";

function stubPermissions(query: ((d: PermissionDescriptor) => Promise<{ state: PermissionState }>) | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    value: query ? { permissions: { query } } : {},
    configurable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "navigator");
});

describe("queryLoopbackPermission", () => {
  it("is unsupported where there is no permissions API", async () => {
    stubPermissions(undefined);
    expect(await queryLoopbackPermission()).toBe("unsupported");
  });

  it("is unsupported where the browser doesn't know the permission", async () => {
    stubPermissions(async () => {
      throw new TypeError("not a valid PermissionName");
    });
    expect(await queryLoopbackPermission()).toBe("unsupported");
  });

  it("passes the browser's state through, asking only for loopback", async () => {
    const asked: string[] = [];
    stubPermissions(async (d) => {
      asked.push(d.name);
      return { state: "denied" };
    });
    expect(await queryLoopbackPermission()).toBe("denied");
    expect(asked).toEqual(["loopback-network"]);
  });
});

describe("pageIsLoopback", () => {
  it("is false without a location", () => {
    expect(pageIsLoopback()).toBe(false);
  });
});
