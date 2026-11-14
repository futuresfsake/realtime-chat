import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ALLOWED_INTERESTS } from "../../../src/matchmaking/interests.js";
import { REPORT_CATEGORIES } from "../../../src/safety/categories.js";
import { PROTOCOL_VERSION } from "../../../src/types/events.js";

// The protocol is documented in docs/03-design/asyncapi.yaml. This test makes
// that document impossible to forget: add an event, an error code, a category
// or an interest in the code without updating it, and the build fails.
const spec = parse(readFileSync("docs/03-design/asyncapi.yaml", "utf8")) as any;
const events = readFileSync("src/types/events.ts", "utf8");

// The event names inside one interface of events.ts.
function eventNames(interfaceName: string): string[] {
  const start = events.indexOf(`export interface ${interfaceName} {`);
  const body = events.slice(start, events.indexOf("\n}", start));
  return [...body.matchAll(/^\s+"?([a-z0-9]+(?::[a-z0-9]+)?)"?:\s*\(/gm)].map((m) => m[1]!);
}
// The members of a string union such as `export type ErrorCode = "A" | "B"`.
function unionMembers(typeName: string): string[] {
  const start = events.indexOf(`export type ${typeName} =`);
  const body = events.slice(start, events.indexOf(";", start));
  return [...body.matchAll(/"([A-Za-z_]+)"/g)].map((m) => m[1]!);
}

describe("docs/03-design/asyncapi.yaml", () => {
  it("is a valid AsyncAPI 2.x document for this protocol version", () => {
    expect(spec.asyncapi).toMatch(/^2\./);
    expect(spec.info.version).toBe(PROTOCOL_VERSION);
    expect(spec.components.schemas.HandshakeAuth.properties.protocolVersion.const).toBe(PROTOCOL_VERSION);
  });

  it("documents every event the client can send, as something the client publishes", () => {
    const sent = eventNames("ClientToServerEvents");
    expect(sent.length).toBeGreaterThan(5);
    for (const name of sent) expect(spec.channels[name]?.publish, `client event ${name}`).toBeDefined();
  });

  it("documents every event the server can send, as something the client subscribes to", () => {
    const received = eventNames("ServerToClientEvents");
    expect(received.length).toBeGreaterThan(5);
    for (const name of received) expect(spec.channels[name]?.subscribe, `server event ${name}`).toBeDefined();
  });

  it("documents nothing that does not exist", () => {
    const known = new Set([...eventNames("ClientToServerEvents"), ...eventNames("ServerToClientEvents")]);
    for (const channel of Object.keys(spec.channels)) expect(known.has(channel), `channel ${channel}`).toBe(true);
  });

  it("has no plaintext message event", () => {
    for (const channel of Object.keys(spec.channels)) expect(channel).not.toMatch(/^chat:/);
  });

  it("lists every error code, handshake error, session end reason and partner state", () => {
    expect(spec.components.schemas.Error.properties.error.properties.code.enum.sort()).toEqual(unionMembers("ErrorCode").sort());
    expect(spec.components.schemas.HandshakeError.enum.sort()).toEqual(unionMembers("HandshakeErrorCode").sort());
    expect(spec.components.messages.Ended.payload.properties.reason.enum.sort()).toEqual(unionMembers("SessionEndReason").sort());
    expect(spec.channels["partner:status"].subscribe.message.payload.properties.state.enum.sort()).toEqual(unionMembers("PartnerState").sort());
  });

  it("lists every report category and every interest, in the same order as the code", () => {
    expect(spec.components.schemas.Report.properties.reason.enum).toEqual([...REPORT_CATEGORIES]);
    expect(spec.components.schemas.SearchPrefs.properties.interests.items.enum).toEqual([...ALLOWED_INTERESTS]);
    expect(spec.components.schemas.SearchPrefs.properties.interests.maxItems).toBe(5);
  });

  it("states the size limits the server enforces", () => {
    const envelope = spec.components.schemas.Envelope.properties;
    expect(envelope.ct.minLength).toBe(107);
    expect(envelope.ct.maxLength).toBe(3000);
    expect(envelope.seq.maximum).toBe(4294967295);
    expect(spec.components.schemas.Key.properties.publicKey.pattern).toBe("^[A-Za-z0-9_-]{87}$");
  });

  it("every schema forbids unknown fields, like the server does", () => {
    for (const name of ["HandshakeAuth", "SearchPrefs", "Report", "Key", "Envelope"]) {
      expect(spec.components.schemas[name].additionalProperties, name).toBe(false);
    }
  });
});
