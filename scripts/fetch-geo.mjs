// Downloads the current DB-IP "IP to Country Lite" database into data/.
// Licence: CC BY 4.0, attribution to DB-IP.com is shown on the page.
// Usage: npm run geo:update   then   COUNTRY_DB_PATH=data/dbip.mmdb npm run dev
import { createWriteStream, mkdirSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

const now = new Date();
// The file for the current month is published a few days in: fall back one month.
const months = [0, 1].map((back) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
});

mkdirSync("data", { recursive: true });
for (const month of months) {
  const url = `https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz`;
  const res = await fetch(url);
  if (!res.ok || !res.body) continue;
  await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream("data/dbip.mmdb"));
  console.log(`saved data/dbip.mmdb (DB-IP ${month})`);
  process.exit(0);
}
console.error("could not download the DB-IP country database");
process.exit(1);
