import { buildServer } from "./app.js";
import { loadConfig } from "./config.js";
import type { Config } from "./config.js";
import { DbIpCountryLookup, noCountryLookup } from "./geo/countryLookup.js";
import type { CountryLookup } from "./geo/countryLookup.js";
import { createLogger } from "./observability/logger.js";

const SHUTDOWN_GRACE_MS = 10_000;

let config: Config;
try {
  config = loadConfig();
} catch (err) {
  // The logger needs a config, so this one line is written by hand.
  // Only the problem is printed: never the environment itself.
  const problem = err instanceof Error ? err.message : "unknown";
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "config_invalid", data: { problem } })}\n`);
  process.exit(1);
}

const logger = createLogger({ level: config.logLevel });
// The country database is optional. Without it (or if it cannot be read) every
// country is unknown, "my country only" is unavailable, and everything else works.
let countries: CountryLookup = noCountryLookup;
if (config.countryDbPath) {
  try {
    countries = await DbIpCountryLookup.open(config.countryDbPath);
    logger.info("country_db_loaded", {});
  } catch (err) {
    logger.error("country_db_failed", { err, data: { hint: "run npm run geo:update, or unset COUNTRY_DB_PATH" } });
  }
}

const { httpServer, shutdown } = buildServer({ config, logger, countries });

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error("port_in_use", { data: { port: config.port, hint: "stop the other server or set PORT" } });
  } else {
    logger.error("server_error", { err });
  }
  process.exit(1);
});

httpServer.listen(config.port, () => {
  logger.info("server_started", {
    data: {
      port: config.port,
      nodeEnv: config.nodeEnv,
      allowedOrigins: config.allowedOrigins,
      previewBanner: config.previewBanner,
      maintenanceMode: config.maintenanceMode,
      countryLookup: countries !== noCountryLookup,
    },
  });
});

// Graceful shutdown: the platform sends SIGTERM on every deploy and restart.
let stopping = false;
function stop(signal: string): void {
  if (stopping) return;
  stopping = true;
  logger.info("shutdown_started", { data: { signal } });
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
  void shutdown().then(() => process.exit(0));
}
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

// Fail fast: an unknown state is worse than a restart.
process.on("unhandledRejection", (err) => {
  logger.error("unhandled_rejection", { err });
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", { err });
  process.exit(1);
});
