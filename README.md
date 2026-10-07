# backend-setup

Reusable, class-based Node.js + Express 5 + TypeScript 6 + Mongoose 9 backend
boilerplate. Strict OOP, layered architecture, structured envelopes, JWT with
DB-backed rotating refresh tokens, pino logs, zod-validated env, 80%+ tested.

> ✦ **Use this template** to clone a new project. Then run `pnpm run init` to
> rename it and rotate the JWT secrets.

---

## Quick start

```bash
git clone <this-repo> my-api
cd my-api
pnpm install            # installs deps + sets up the husky pre-commit hook
pnpm run init           # interactive: project name, generates .env with rotated secrets
# Make sure MongoDB is running locally on :27017
pnpm dev
```

You should see `Server listening on port 3000` and a structured pino log line
per request. Hit `http://localhost:3000/health` to confirm.

---

## What's inside

```
src/
├── core/                      reusable backbone (every project keeps this)
│   ├── base/                    abstract base classes (controller, service, repository)
│   ├── errors/                  AppError + 6 concrete subclasses
│   ├── middlewares/             auth, authorize, validate, pagination, rate-limit, error-handler, request-id
│   ├── types/                   ResponseEnvelope, PaginationOptions/Meta, Express.Request augments
│   ├── utils/                   ResponseBuilder, PaginationBuilder, parseDurationToMs
│   └── interfaces/              IRepository / IService markers
│
├── modules/
│   ├── auth/                    register / login / refresh / logout / password reset
│   ├── user/                    canonical reference module — mirror this when adding features
│   └── security/                opt-in: HMAC, device fingerprint, honeypot, IP-abuse (see its README)
│
├── config/
│   ├── env.ts                   zod-validated env, fail-fast at boot
│   ├── logger.ts                pino-backed Logger with child(requestId)
│   └── database.ts              Mongoose connect/disconnect + graceful shutdown
│
├── routes/index.ts            mounts /api/v1/* — imports each module's `*.module.ts`
├── app.ts                     App class — security → middleware → routes → error handler last
└── server.ts                  bootstrap → DB connect → listen → SIGTERM/SIGINT shutdown

scripts/
├── init.ts                    interactive project setup (name, secrets, DB)
└── generate-module.ts         scaffold a new feature module (8 files)

docs/
└── ARCHITECTURE.md            decisions log — read when you need to know "why"

CLAUDE.md / PROMPT.md          architectural rules (the contract)
WORKING.md                     ⭐ the practical how-to — read this first
```

For naming conventions, layer responsibilities, the recipe for adding a new
feature module, and common gotchas, see [**WORKING.md**](./WORKING.md).

---

## The contract

- **Every layer is a class.** No loose functions for business logic.
- **Strict layering.** `Routes → Controller → Service → Repository → Model`.
  Lower layers never import from higher.
- **Single response envelope.** Every JSON response is
  `{ success, data?, meta?, error? }`. `ResponseBuilder` is the only writer.
- **All errors extend `AppError`.** The centralized error handler turns them
  into envelopes with stable `code` strings (`UNAUTHORIZED`, `NOT_FOUND`, …).
- **All env vars validated at boot.** zod schema in [`src/config/env.ts`](./src/config/env.ts);
  process exits with formatted errors if missing/invalid.
- **All inputs validated at the route.** `ValidateMiddleware.body/params/query`
  wraps zod schemas and turns failures into a 422 envelope.

---

## Adding a feature

```bash
pnpm g:module order
```

Generates `src/modules/order/` with all 8 files (model, types, validator,
repository, service, controller, routes, module) plus a stub validator test.
Then mount it in [`src/routes/index.ts`](./src/routes/index.ts):

```ts
import orderRoutes from "../modules/order/order.module";
this.router.use("/orders", orderRoutes);
```

For the full walkthrough including service / integration tests, see
[**WORKING.md** § Adding a new feature module](./WORKING.md#adding-a-new-feature-module).

---

## OAuth providers

Each provider lives on its own feature branch off `main` so you can pick the
ones you need without merging the others.

| Provider  | Branch                                                                                                      | Status     | Setup guide                                      |
| --------- | ----------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------ |
| Google    | [`oAuth/google`](https://github.com/Coder-safal/backend-setup-nodejs-express-typescripts/tree/oAuth/google) | ✅ ready   | [`docs/oauth/google.md`](./docs/oauth/google.md) |
| Facebook  | `oAuth/facebook`                                                                                            | ⏳ planned | —                                                |
| Instagram | `oAuth/instagram`                                                                                           | ⏳ planned | —                                                |
| TikTok    | `oAuth/tiktok`                                                                                              | ⏳ planned | —                                                |

To enable a provider after merging its branch into your project:

1. Follow the provider-specific setup guide in [`docs/oauth/`](./docs/oauth/) to
   register an OAuth app and get a Client ID / Secret.
2. Add the provider's env vars to `.env` (see [`.env.example`](./.env.example)
   for the keys). The env-validator refuses to boot half-configured.
3. Restart the server. Look for `<Provider> OAuth: enabled at /api/v1/auth/<provider>`
   in the logs to confirm.

The flow is the same for all providers — Authorization Code with HMAC-signed
state cookie, server-side token exchange, profile fetch, then our normal JWT
access+refresh cookies. See [`docs/OAUTH.md`](./docs/OAUTH.md) for the design.

---

## Stack

| Concern        | Choice                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| Runtime        | Node 20+                                                                        |
| Web framework  | Express 5                                                                       |
| Language       | TypeScript 6 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Database       | MongoDB 6+ via Mongoose 9                                                       |
| Validation     | zod 4                                                                           |
| Auth           | JWT access + DB-backed rotating refresh; bcrypt 12                              |
| Logging        | pino + pino-http (pretty in dev, JSON in prod, request-id child loggers)        |
| Tests          | Jest 29 + ts-jest + supertest                                                   |
| Linting        | ESLint 10 (flat config) + Prettier                                              |
| Pre-commit     | husky + lint-staged                                                             |
| Module aliases | `@core`, `@config`, `@modules`, `@utils`                                        |

For the _why_ behind each choice, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Scripts

| Command                | What it does                                                |
| ---------------------- | ----------------------------------------------------------- |
| `pnpm dev`             | ts-node-dev with tsconfig-paths + hot reload                |
| `pnpm build`           | `tsc` then `tsc-alias` (rewrites `@core/*` etc. in `dist/`) |
| `pnpm start`           | `node dist/server.js`                                       |
| `pnpm typecheck`       | `tsc --noEmit`                                              |
| `pnpm lint`            | ESLint + Prettier check                                     |
| `pnpm format`          | Prettier write                                              |
| `pnpm test`            | Jest                                                        |
| `pnpm test:watch`      | Jest watch mode                                             |
| `pnpm test:cov`        | Jest with coverage (80% threshold enforced)                 |
| `pnpm init`            | Interactive setup: project name, JWT secrets, DB            |
| `pnpm g:module <name>` | Scaffold `src/modules/<name>/`                              |

---

## Environment

Every variable lives in [`.env.example`](./.env.example). Copy it to `.env` (or
let `pnpm run init` do it for you with rotated secrets).

The schema in [`src/config/env.ts`](./src/config/env.ts) is the single source
of truth — adding a new variable means adding it to the schema first; the app
won't boot until it's set.

Required for boot: `DB_URL`, `JWT_SECRET` (≥32 chars), `JWT_REFRESH_SECRET`
(≥32 chars), `CLIENT_URL`. Everything else has sensible defaults.

---

## Testing

```bash
pnpm test              # run once
pnpm test:watch        # watch mode
pnpm test:cov          # coverage; threshold 80% on /core and services
```

Coverage threshold is enforced — pull requests that drop below 80% on any of
statements / branches / functions / lines fail in CI.

Integration tests use **mocked repositories** — they exercise the full Express
pipeline (helmet, cors, hpp, request-id, validation, error handler, response
envelope) without needing a running database. Real DB-backed integration tests
are a future enhancement (would use `mongodb-memory-server`).

Rate limiters are mocked at the per-test level so the auth route's
10-req-per-15-min limit doesn't make the test suite flaky.

---

## Production checklist

Before deploying:

1. **Rotate every secret.** `JWT_SECRET`, `JWT_REFRESH_SECRET`, `HMAC_SECRET`,
   `API_KEY`. The `.env.example` defaults are _deliberately_ not random — they
   exist to make the dev server boot, not to be safe.
2. **Set `NODE_ENV=production`.** This switches pino from pretty-print to JSON,
   sets cookies to `secure: true; sameSite: none`, and hides stack traces.
3. **Set `COOKIE_DOMAIN`** if your API and frontend live on subdomains of the
   same parent domain; otherwise leave it unset.
4. **Set `CLIENT_URL`** to your real frontend origin. CORS is strict — wildcard
   isn't supported.
5. **Bump `BCRYPT_SALT_ROUNDS`** if you can afford the CPU. 12 is the floor;
   13 is conservative; 14+ is paranoid.
6. **Run `pnpm build` then `pnpm start`.** Don't run `ts-node-dev` in
   production.
7. **Front the app with a reverse proxy** that terminates TLS, sets
   `X-Forwarded-For`, and rate-limits at the edge. Express has
   `trust proxy: 1` set, which expects exactly one proxy in front.
8. **Health endpoint:** `GET /health` returns `{ status: "ok", uptime }`.
   Wire it to your platform's liveness/readiness probes.

---

## What's next

The boilerplate is feature-complete for new projects. Two enhancements are
deliberately deferred:

- **NoSQL sanitization.** `express-mongo-sanitize` mutates `req.query`, which
  is read-only in Express 5. Either a custom replacement or a patched fork
  will land when one is stable.
- **`mongodb-memory-server` integration tests** for `BaseRepository`. Adds
  ~100 MB of binary downloads on first test run; for now the abstraction is
  thin enough that mocked-repository integration tests give us most of the
  signal.

Both are tracked in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## License

MIT — see [`LICENSE`](./LICENSE).
