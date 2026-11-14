import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import { ProofOfWork as ServerPow } from "../../../src/security/proofOfWork.js";

interface Solver {
  solve(challenge: string, bits: number): Promise<string>;
  leadingZeroBits(bytes: Uint8Array): number;
}

// Runs the page's solver in isolation, the way the browser loads it.
function load(): Solver {
  const sandbox: Record<string, any> = { crypto: webcrypto, TextEncoder, Promise, Array, String, Error };
  sandbox.globalThis = sandbox;
  const file = path.join(process.cwd(), "public", "js", "pow.js");
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.ProofOfWork as Solver;
}
const solver = load();

describe("the page's proof-of-work solver", () => {
  it("finds an answer the SERVER accepts", async () => {
    const server = new ServerPow(new FakeClock(1_000_000), 10);
    const { challenge, bits } = server.issue("ip-a");
    const nonce = await solver.solve(challenge, bits);
    expect(nonce).toMatch(/^\d+$/);
    expect(server.verify(challenge, nonce, "ip-a")).toEqual({ ok: true });
  });

  it("answers at once when there is no difficulty", async () => {
    expect(await solver.solve("anything", 0)).toBe("0");
  });

  it("counts leading zero bits the same way the server does", () => {
    expect(solver.leadingZeroBits(Uint8Array.from([0x00, 0x80]))).toBe(8);
    expect(solver.leadingZeroBits(Uint8Array.from([0x01]))).toBe(7);
    expect(solver.leadingZeroBits(Uint8Array.from([0xff]))).toBe(0);
  });

  it("solves the default difficulty (12 bits) quickly", async () => {
    const server = new ServerPow(new FakeClock(1_000_000), 12);
    const { challenge } = server.issue("ip-a");
    const started = Date.now();
    const nonce = await solver.solve(challenge, 12);
    expect(Date.now() - started).toBeLessThan(3000); // a fraction of a second in practice
    expect(server.verify(challenge, nonce, "ip-a").ok).toBe(true);
  });

  it("never touches the page, the network or storage", () => {
    const code = readFileSync(path.join(process.cwd(), "public", "js", "pow.js"), "utf8");
    expect(code).not.toMatch(/innerHTML|document\.|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|console\./);
  });
});
