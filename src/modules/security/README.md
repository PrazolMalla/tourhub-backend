# Security module (opt-in)

These middlewares are project-specific patterns we lifted from a complaint-portal
codebase. They are useful, but too narrow to live in `core/`. Each one is **off by
default** — wire it explicitly into your routes when you need it.

| Class                                               | Use when                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `HmacMiddleware`                                    | The client signs every request with HMAC-SHA256 (mobile app, locked-down service-to-service).   |
| `AttachDeviceMiddleware` / `VerifyDeviceMiddleware` | You want to fingerprint the requesting device and gate routes on it.                            |
| `HoneypotMiddleware`                                | A public form is being scraped/abused by bots. Drop a hidden field on the frontend.             |
| `IpAbuseMiddleware`                                 | A public endpoint sees abusive submission frequency that the global rate-limiter doesn't catch. |

## Wiring examples

### HMAC verification on a route group

```ts
import { Router } from "express";
import { HmacMiddleware } from "@modules/security";

const hmac = HmacMiddleware.fromEnv(); // throws if HMAC_SECRET / API_KEY are unset
const router = Router();
router.use(hmac.handle);
// ...routes...
```

`fromEnv()` deliberately refuses to fall back to placeholder secrets. Set
`HMAC_SECRET` and `API_KEY` in `.env`, plus optionally
`REQUEST_TIMESTAMP_TOLERANCE_MS` (default 5 min).

The client must send three headers:

- `x-api-key` — the configured API key
- `x-request-timestamp` — Unix ms when the request was signed
- `x-signature` — `HMAC-SHA256(timestamp + path[?query] + bodyJSON)` hex digest

`x-device-id` and `x-platform` are optional and only used for log enrichment.

### Device fingerprinting

```ts
import { AttachDeviceMiddleware, VerifyDeviceMiddleware } from "@modules/security";

router.use(new AttachDeviceMiddleware().handle); // sets req.deviceInfo
router.use("/secure", protect, new VerifyDeviceMiddleware().handle, secureHandler);
```

`AttachDeviceMiddleware` is best applied early so downstream handlers can read
`req.deviceInfo`. `VerifyDeviceMiddleware` is the simplest "must be set" guard —
extend it (or add a service) if you want to check the device against a per-user
allowlist.

### Honeypot + IP-abuse on a public submission route

```ts
import { HoneypotMiddleware, IpAbuseMiddleware } from "@modules/security";

const ipAbuse = new IpAbuseMiddleware();
ipAbuse.start(); // start the periodic cleanup
process.on("SIGTERM", () => ipAbuse.stop());

router.post(
  "/feedback",
  new HoneypotMiddleware("_hp_field").handle,
  ipAbuse.handle,
  validateFeedback,
  feedbackController.submit,
);
```

The frontend includes `<input name="_hp_field" type="text" hidden>`. Real users
leave it empty; bots fill it in. When triggered, the middleware returns a fake
`{ success: true }` envelope so the bot keeps thinking it succeeded.

`IpAbuseMiddleware` defaults: 10 submissions per IP per hour, with cleanup every
30 minutes. Tweak via constructor args.

## Why these aren't in `core/`

`core/` is the "every project needs this" backbone (errors, error handler,
request id, response builder, base classes, pagination). The security middlewares
are tactical: they exist to solve specific abuse vectors. Most projects won't
need them — the ones that do should opt in deliberately.

If you're building a new project from this template and don't need any of them,
delete this folder.
