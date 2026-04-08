# KOL Proof

KOL Proof is a Next.js frontend for a crypto-native KOL reputation registry backed by InsForge database and storage services.

## Required Environment

Copy `.env.example` to `.env.local` and set these values:

```bash
NEXT_PUBLIC_INSFORGE_URL=https://your-project.region.insforge.app
INSFORGE_API_KEY=ik_your_server_api_key
INSFORGE_PROJECT_ID=your-project-id
KOL_PROOF_SESSION_SECRET=replace-with-a-long-random-secret
```

Optional configuration:

```bash
NEXT_PUBLIC_INSFORGE_ANON_KEY=
INSFORGE_STORAGE_BUCKET_EVIDENCE=evidence
INSFORGE_STORAGE_BUCKET_AVATARS=avatars
KOL_PROOF_COMMENT_FEE_ETH=0.05
```

Production requirements:

- `KOL_PROOF_SESSION_SECRET` must be rotated away from `change-me-in-production`.
- `NEXT_PUBLIC_INSFORGE_URL`, `INSFORGE_API_KEY`, `INSFORGE_PROJECT_ID`, and `KOL_PROOF_SESSION_SECRET` are mandatory for all core flows.
- The app no longer supports a dev/mock backend fallback.

## Backend Setup

Apply InsForge schema in this order:

```bash
npx @insforge/cli db import insforge/schema/001_kol_proof_core.sql
npx @insforge/cli db import insforge/schema/002_kol_proof_policies.sql
npx @insforge/cli db import insforge/schema/004_kol_proof_rate_limits.sql
```

Do not apply `insforge/schema/003_kol_proof_dev_seed.sql` in production.

Create required storage buckets:

```bash
npx @insforge/cli storage create-bucket evidence
npx @insforge/cli storage create-bucket avatars
```

## Local Runbook

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Validation before deploy:

```bash
npm run lint
npm run build
```

## Health Checks

Backend and auth:

```bash
curl "$NEXT_PUBLIC_INSFORGE_URL/health"
curl -X POST http://localhost:3000/api/auth/wallet/challenge -H "Content-Type: application/json" -d "{\"walletAddress\":\"11111111111111111111111111111111\"}"
curl http://localhost:3000/api/leaderboard?tab=trusted
curl http://localhost:3000/api/kols
curl http://localhost:3000/api/me
```

Expected behavior:

- `/api/leaderboard` returns `200` with real backend data or a clean empty state.
- `/api/kols` returns `200` with the live home-card feed.
- `/api/me` returns `200` with either a real session/profile or clean `null` values.
- Wallet challenge returns `200` and sets the signed challenge cookie.

## Launch Checklist

- Required env values are present in the deploy target.
- `001`, `002`, and `004` have been applied to the correct InsForge project.
- `evidence` and `avatars` buckets exist.
- `npm run lint` passes.
- `npm run build` passes.
- Create KOL, vote, comment, and evidence upload flows have been smoke-tested against the production backend.
- Rate limiting returns `429` with `Retry-After` for abusive traffic.
- Structured server logs are being collected from the host platform.

## Rollback Notes

- Frontend rollback: redeploy the previous application build.
- Schema rollback: remove or disable callers before dropping `request_rate_limits` or `check_and_increment_rate_limit`.
- Storage rollback: do not delete live `evidence` or `avatars` buckets unless the application has already been rolled back away from upload features.

## Known Operational Limits

- Comment payment settlement is not implemented yet; comments persist with `payment_status = pending`.
- Session revocation is cookie-expiry based; there is no server-side revoke list yet.
- There is no admin moderation surface yet for `hidden` or `flagged` content.
