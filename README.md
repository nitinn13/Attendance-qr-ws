# QR Attendance Service

A standalone microservice that generates rotating QR codes for attendance
and delegates everything else — identity, enrollment checks, and the
actual `Attendance` write — to the main backend.

## Architecture

This service has **no database of its own**. It holds QR sessions
entirely in memory and trusts the main backend to:

- Validate JWTs and resolve user identity
- Confirm a teacher owns the class/session they're starting QR for
- Confirm a student is enrolled before marking them present
- Prevent duplicate attendance for the same session
- Actually persist the `Attendance` row

This service's only job is rotating a token every few seconds and
recognizing whether a scanned token matches what it most recently
displayed.

### Why this split

A QR scan needs a *fast, ephemeral* secret server (rotate every 5s, no
real persistence) but also needs to *trust someone* about who the
scanning student actually is. Rather than duplicating your auth/JWT
logic and Prisma models here, this service forwards the caller's own
`Authorization` header straight through to the main backend on every
privileged action. It never decodes the JWT itself.

```
Teacher's browser                Student's phone
       |                                |
       | POST /qr/start                 | POST /qr/verify
       | Authorization: Bearer <jwt>    | Authorization: Bearer <jwt>
       v                                v
  +-------------------------------------------+
  |          QR Attendance Service             |
  |  (this repo — in-memory only, no DB)       |
  +-------------------------------------------+
       |                                |
       | GET /teacher/session/:id       | POST /student/mark-attendance
       | (forwarded teacher JWT)        | (forwarded student JWT)
       v                                v
  +-------------------------------------------+
  |           Main Backend (Prisma)            |
  |  owns Class / Session / Enrollment /       |
  |  Attendance, all auth, all business rules  |
  +-------------------------------------------+
```

## Requirements on the main backend

This service calls two endpoints on `MAIN_API_URL`. One of them
(`mark-attendance`) already exists in your codebase as-is. The other
(`GET /teacher/session/:id`) needs to be added — see
`main-backend-additions/` alongside this folder for the controller and
route changes.

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /teacher/session/:id` | Teacher JWT | Confirm the session exists, belongs to this teacher, and `isAttendanceOpen` is true, before starting a QR run. |
| `POST /student/mark-attendance` | Student JWT, body `{ sessionId }` | Already exists. Handles enrollment check, open check, duplicate check, and the actual `Attendance` write. |

## Endpoints exposed by this service

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Liveness check |
| `POST` | `/qr/start` | Teacher JWT (forwarded) | Body `{ sessionId }`. Starts a rotating QR for that session. |
| `POST` | `/qr/stop` | Any Bearer token | Body `{ sessionId }`. Stops a running QR early. |
| `GET` | `/qr/active` | none | Query `?sessionId=`. Returns the currently displayed QR image, polled by students. |
| `POST` | `/qr/verify` | Student JWT (forwarded) | Body `{ sessionId, qrToken, token }`. Verifies the scan and marks attendance via the main backend. |

### Why `/active` has no auth requirement

Viewing a QR code (e.g. a teacher's projector screen, or a student's
poll-to-display) doesn't reveal anything sensitive — it's just an
image with two random tokens in it that expire in seconds. The
sensitive action is `/verify`, which is gated.

### A known gap, intentionally left open

`/qr/stop` currently accepts any valid Bearer token — it doesn't
verify the caller is the teacher who owns that specific session. To
close this fully, `/qr/stop` should also call `GET
/teacher/session/:id` the way `/qr/start` does. This was left as a
deliberate trade-off (one fewer upstream call on the "stop" path,
which is low-risk since the worst case is a QR getting stopped early)
— tighten it if that risk profile doesn't fit your use case.

## Setup

```bash
npm install
cp .env.example .env
# edit .env — at minimum set MAIN_API_URL to your main backend's URL

npm run dev      # tsx watch mode
npm run build    # compile to dist/
npm start        # run the compiled build
npm run typecheck
```

## Environment variables

See `.env.example`. The service validates all environment variables
with Zod at boot and exits immediately with a clear error if anything
required is missing or malformed — it will never silently run with
broken config.

## Security notes

- **Rate limiting**: `/qr/verify` is capped at 20 requests/minute/IP,
  `/qr/start` at 30/minute/IP, via `express-rate-limit`.
- **Helmet**: standard security headers applied via `helmet()`.
- **No secrets stored here**: this service has no JWT secret, no
  database credentials, nothing to leak beyond `MAIN_API_URL`.
- **Token rotation**: the displayed QR token changes every
  `QR_TOKEN_REFRESH_MS` (default 5s), so a photographed/screen-shared
  QR code has a short window of validity.
