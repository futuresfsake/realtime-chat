import { open } from "maxmind";
import type { CountryResponse, Reader } from "maxmind";
import { UNKNOWN_COUNTRY } from "../matchmaking/interests.js";

// Turns an address into a two-letter country code. The address is used for the
// lookup and nothing else: only the code is kept, in memory, for the length of
// the connection (ADR-0009, RA 10173 data minimisation).
export interface CountryLookup {
  lookup(address: string): string; // ISO 3166-1 alpha-2, or "XX"
}

// Used when no database is configured: every country is unknown, so "my
// country" cannot be chosen and everyone is matched worldwide.
export const noCountryLookup: CountryLookup = { lookup: () => UNKNOWN_COUNTRY };

// A fixed table, for tests.
export class FakeCountryLookup implements CountryLookup {
  constructor(private readonly table: Record<string, string>) {}
  lookup(address: string): string {
    return this.table[address] ?? UNKNOWN_COUNTRY;
  }
}

// DB-IP "IP to Country Lite" (CC BY 4.0: the page shows the attribution).
// Only the small `country.iso_code` field is read.
export class DbIpCountryLookup implements CountryLookup {
  private constructor(private readonly reader: Reader<CountryResponse>) {}

  static async open(path: string): Promise<DbIpCountryLookup> {
    return new DbIpCountryLookup(await open<CountryResponse>(path));
  }

  lookup(address: string): string {
    try {
      const code = this.reader.get(address)?.country?.iso_code;
      return typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : UNKNOWN_COUNTRY;
    } catch {
      return UNKNOWN_COUNTRY; // not a valid address, or a malformed record
    }
  }
}
