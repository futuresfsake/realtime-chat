import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DbIpCountryLookup, FakeCountryLookup, noCountryLookup } from "../../../src/geo/countryLookup.js";

describe("noCountryLookup", () => {
  it("says every country is unknown", () => {
    expect(noCountryLookup.lookup("8.8.8.8")).toBe("XX");
  });
});

describe("FakeCountryLookup", () => {
  it("answers from its table, and XX for anything else", () => {
    const fake = new FakeCountryLookup({ "1.1.1.1": "PH" });
    expect(fake.lookup("1.1.1.1")).toBe("PH");
    expect(fake.lookup("2.2.2.2")).toBe("XX");
  });
});

describe("DbIpCountryLookup", () => {
  it("refuses to start without a readable database", async () => {
    await expect(DbIpCountryLookup.open("data/does-not-exist.mmdb")).rejects.toThrow();
  });

  // The real database is a 8 MB download (`npm run geo:update`), not part of
  // the repository. This test runs only where it is present.
  const db = "data/dbip.mmdb";
  it.skipIf(!existsSync(db))("reads real addresses from the DB-IP file", async () => {
    const lookup = await DbIpCountryLookup.open(db);
    expect(lookup.lookup("8.8.8.8")).toBe("US");
    expect(lookup.lookup("112.198.64.1")).toBe("PH");
    expect(lookup.lookup("103.2.3.4")).toBe("JP");
  });
  it.skipIf(!existsSync(db))("answers XX for private, loopback, malformed and empty addresses", async () => {
    const lookup = await DbIpCountryLookup.open(db);
    for (const address of ["127.0.0.1", "10.0.0.1", "::1", "not-an-ip", "", "unknown"]) {
      expect(lookup.lookup(address), address).toBe("XX");
    }
  });
});
