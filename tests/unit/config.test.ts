import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  it("applies safe defaults when nothing is set", () => {
    const config = loadConfig({});
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe("development");
    expect(config.allowedOrigins).toEqual(["http://localhost:3000"]);
    expect(config.trustProxyHops).toBe(0);
    expect(config.previewBanner).toBe(false);
    expect(config.maxPayloadBytes).toBe(4096);
    expect(config.maxSocketsPerIp).toBe(5);
  });

  it("reads and trims a list of origins", () => {
    const config = loadConfig({ ALLOWED_ORIGINS: " https://a.example , https://b.example:8443 " });
    expect(config.allowedOrigins).toEqual(["https://a.example", "https://b.example:8443"]);
  });

  it("treats empty variables as not set", () => {
    const config = loadConfig({ PORT: "", IP_HASH_SECRET: "", LOG_LEVEL: " " });
    expect(config.port).toBe(3000);
    expect(config.ipHashSecret).toBeUndefined();
    expect(config.logLevel).toBe("info");
  });

  it("parses flags", () => {
    expect(loadConfig({ PREVIEW_BANNER: "true" }).previewBanner).toBe(true);
    expect(loadConfig({ PREVIEW_BANNER: "1" }).previewBanner).toBe(true);
    expect(loadConfig({ MAINTENANCE_MODE: "0" }).maintenanceMode).toBe(false);
    expect(() => loadConfig({ PREVIEW_BANNER: "yes" })).toThrow();
  });

  it.each([
    ["PORT", "abc"],
    ["PORT", "70000"],
    ["NODE_ENV", "staging"],
    ["TRUST_PROXY_HOPS", "-1"],
    ["LOG_LEVEL", "verbose"],
    ["IP_HASH_SECRET", "too-short"],
    ["MAX_SOCKETS_PER_IP", "0"],
  ])("throws on invalid %s=%s", (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow();
  });

  it.each(["chat.example", "https://chat.example/", "https://chat.example/path", "*", "https://*.example"])(
    "throws when an origin is not exact: %s",
    (origin) => {
      expect(() => loadConfig({ ALLOWED_ORIGINS: origin })).toThrow();
    },
  );

  it("requires https origins in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "http://chat.example" })).toThrow();
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(); // default is http://localhost
    expect(loadConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://chat.example" }).nodeEnv).toBe("production");
  });
});
