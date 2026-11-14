# TDD-M2-US23: Only Our Site Connects (Security Headers + Origin)

**Milestone:** M2 Hardening + CI/CD + First Deploy
**Story:** US-23 — As a chatter, only our website can connect
**Features:** F-09 (helmet + CSP, Origin allowlist, 4 KB payload limit)
**Gaps:** G-14 (CSP hash for inline theme script)

## Acceptance Criteria

- A socket opened from another website's origin is refused
- Security headers grade ≥ A on securityheaders.com
- Payload limit: 4 KB max

## Technical Design

### 1. Security Headers (`src/http/securityHeaders.ts`)

Using `helmet` (to install):

```ts
import helmet from "helmet";
import type { Config } from "../config.js";

export function securityHeaders(config: Config) {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],  // No unsafe-inline; theme script must move to a file or use a hash
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'", "wss:"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],  // T-06: clickjacking
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,  // not needed, breaks Socket.IO long-polling fallback
    hsts: config.nodeEnv === "production" ? { maxAge: 31536000, includeSubDomains: true } : false,
  });
}
```

**CSP inline script issue (G-14):** The current `index.html` has an inline `<script>` for theme loading from localStorage. Options:
1. Move the theme script to `public/js/themes.js` (preferred — eliminates the need for any CSP exception)
2. Compute SHA-256 hash and add to `script-src`

Decision: option 1 — move to external file.

### 2. Origin Allowlist (`src/gateway/connectionGuards.ts`)

Added to the existing connection guards module:

```ts
export function checkOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}
```

Applied in Socket.IO server config:
```ts
const io = new Server(httpServer, {
  maxHttpBufferSize: config.maxPayloadBytes,
  cors: {
    origin: (origin, callback) => {
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed"));
      }
    },
  },
});
```

And in the connection middleware:
```ts
io.use((socket, next) => {
  const origin = socket.handshake.headers.origin;
  if (!checkOrigin(origin, config.allowedOrigins)) {
    return next(new Error("Origin not allowed"));
  }
  next();
});
```

### 3. Health Endpoint Hardening (`src/http/health.ts`)

```ts
export function healthRoute(isShuttingDown: () => boolean) {
  return (_req: Request, res: Response) => {
    if (isShuttingDown()) {
      res.status(503).set("Cache-Control", "no-store").json({ status: "shutting_down" });
    } else {
      res.status(200).set("Cache-Control", "no-store").json({ status: "ok" });
    }
  };
}
```

### 4. Package Changes

```bash
npm install helmet
```

## Test Plan (TDD — write tests FIRST)

### Unit Tests: `tests/unit/gateway/connectionGuards.test.ts` (extend)

```
describe("checkOrigin")
  ✅ allowed origin → true
  ❌ disallowed origin → false
  ❌ no origin header → false
  ✅ multiple allowed origins, one matches → true
  ❌ substring match ("http://evil.example.com" vs "http://example.com") → false
```

### Unit Tests: `tests/unit/http/securityHeaders.test.ts`

```
describe("securityHeaders")
  ✅ response includes Content-Security-Policy header
  ✅ CSP has frame-ancestors 'none'
  ✅ CSP has script-src 'self' (no unsafe-inline)
  ✅ X-Content-Type-Options is nosniff
  ✅ X-Frame-Options is DENY or SAMEORIGIN
  ✅ HSTS set in production mode
  ✅ HSTS not set in development mode
```

### Unit Tests: `tests/unit/http/health.test.ts`

```
describe("healthRoute")
  ✅ normal → 200 { status: "ok" }
  ✅ shutting down → 503 { status: "shutting_down" }
  ✅ includes Cache-Control: no-store
```

### Integration Test: `tests/integration/origin.test.ts`

```
describe("Origin enforcement")
  ✅ client with allowed origin → connects
  ❌ client with evil.example origin → refused
  ❌ client with no origin → refused
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/http/securityHeaders.ts` | Create |
| `src/http/health.ts` | Create (extract from app.ts) |
| `src/gateway/connectionGuards.ts` | Extend with checkOrigin |
| `src/app.ts` | Modify — add helmet, origin config, maxHttpBufferSize |
| `public/js/themes.js` | Create (move inline theme script) |
| `public/index.html` | Modify — remove inline script, add `<script src="js/themes.js">` |
| `package.json` | Add helmet |
| `tests/unit/http/securityHeaders.test.ts` | Create |
| `tests/unit/http/health.test.ts` | Create |
| `tests/integration/origin.test.ts` | Create |

## Dependencies

- `helmet` (to install)

## Threat Mitigations

- T-04 (CSWSH): Origin allowlist
- T-05 (XSS): strict CSP, no unsafe-inline
- T-06 (clickjacking): frame-ancestors 'none'
- T-01 (oversized payloads): maxHttpBufferSize 4 KB
