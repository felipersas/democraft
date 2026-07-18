import { describe, expect, it } from "vitest";
import { diagnosticCodes } from "@democraft/schema";
import {
  DiscoveryOriginError,
  assertDiscoveryAllowed,
  normalizeDiscoveryOrigin,
  parseDiscoveryHttpUrl,
} from "./discovery-origin";

describe("discovery origin allowlist", () => {
  it("permits the page's own origin when no allowlist is given", () => {
    expect(() =>
      assertDiscoveryAllowed("http://localhost:3000/dashboard"),
    ).not.toThrow();
  });

  it("permits an explicitly allowed origin on a non-default port", () => {
    expect(() =>
      assertDiscoveryAllowed("https://app.example.com:8443/x", [
        "https://app.example.com:8443",
      ]),
    ).not.toThrow();
  });

  it("blocks an origin not present in an explicit allowlist", () => {
    try {
      assertDiscoveryAllowed("http://evil.test/x", [
        "http://localhost:3000",
      ]);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DiscoveryOriginError);
      expect((error as DiscoveryOriginError).code).toBe(
        diagnosticCodes.discoveryOriginBlocked,
      );
      expect((error as DiscoveryOriginError).toDiagnostic().severity).toBe(
        "error",
      );
    }
  });

  it("treats http and https as distinct origins", () => {
    expect(() =>
      assertDiscoveryAllowed("https://localhost:3000", ["http://localhost:3000"]),
    ).toThrow(DiscoveryOriginError);
    expect(() =>
      assertDiscoveryAllowed("https://localhost:3000", ["http://localhost:3000"]),
    ).toThrow(/not in the discovery allowlist/);
  });

  it("rejects non-web schemes", () => {
    expect(() => parseDiscoveryHttpUrl("javascript:alert(1)")).toThrow(
      DiscoveryOriginError,
    );
    expect(
      (() => {
        try {
          parseDiscoveryHttpUrl("data:text/html,<x>");
          return null;
        } catch (error) {
          return (error as DiscoveryOriginError).code;
        }
      })(),
    ).toBe(diagnosticCodes.discoveryUnsafeScheme);
    expect(() => parseDiscoveryHttpUrl("file:///etc/passwd")).toThrow(
      /http or https/,
    );
  });

  it("rejects credentials and fragments", () => {
    expect(() =>
      parseDiscoveryHttpUrl("http://user:pass@localhost:3000/"),
    ).toThrow(/credentials or a fragment/);
    expect(() =>
      parseDiscoveryHttpUrl("http://localhost:3000/#frag"),
    ).toThrow(/credentials or a fragment/);
  });

  it("normalizes origins and strips paths", () => {
    expect(normalizeDiscoveryOrigin("http://localhost:3000/dashboard")).toBe(
      "http://localhost:3000",
    );
    expect(
      normalizeDiscoveryOrigin("https://APP.example.com:443/"),
    ).toBe("https://app.example.com");
  });
});
