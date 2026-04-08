# KOL Proof Productization Notes

## Design Source Of Truth
- `design-reference/png/*`
- `design-reference/html/*`
- `design-reference/spec.md`
- `design-reference/md/stitch_kol_trust_protocol_DESIGN.md`

## Backend Structure
- `lib/env.ts` owns all runtime configuration and keeps secrets server-side only.
- `lib/insforge/*` contains the InsForge client, storage helpers, public auth config fetch, and signed session helpers.
- `lib/backend/*` contains product behavior: auth, KOL creation, leaderboard queries, comments, metrics, and profile aggregation.
- `app/api/*` is the only public write surface for MVP flows.

## Current MVP Behavior
- Core flows require InsForge database/storage credentials and fail closed when backend config is missing.
- Solana wallet auth is handled through a signed challenge/session flow in Next.js route handlers.
- Comments persist with `payment_status = pending` until a real settlement backend is added.

## First Wired Flows
1. Add KOL submits to `POST /api/kols`.
2. Leaderboard reads from `GET /api/leaderboard`.
3. KOL profile and comment flows use `/api/kols/[slug]`, `/vote`, `/comments`, and `/api/comments/[commentId]/evidence`.
4. User profile and topbar auth state read from `GET /api/me`.
