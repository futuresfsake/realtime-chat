import type { RequestHandler } from "express";
import helmet from "helmet";
import type { Config } from "../config.js";

export const CSP_REPORT_PATH = "/csp-report";

// https://example.com -> wss://example.com (and http -> ws for local dev)
function webSocketOrigin(origin: string): string {
  return origin.replace(/^http/, "ws");
}

export function securityHeaders(config: Config): RequestHandler[] {
  const production = config.nodeEnv === "production";

  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // no inline scripts, no eval
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", ...config.allowedOrigins.map(webSocketOrigin)],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"], // clickjacking
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        reportUri: [CSP_REPORT_PATH],
        reportTo: ["csp"],
        ...(production ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
    xFrameOptions: { action: "deny" },
    strictTransportSecurity: production ? { maxAge: 63_072_000, includeSubDomains: true } : false,
  });

  const extraHeaders: RequestHandler = (_req, res, next) => {
    res.setHeader("Reporting-Endpoints", `csp="${CSP_REPORT_PATH}"`);
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
    next();
  };

  return [helmetMiddleware, extraHeaders];
}
