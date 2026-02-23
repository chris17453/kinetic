# Kinetic — Gap Fix Tasks

Tracks remediation of all findings from `gap.md`.
Status: `[ ]` = open · `[x]` = done · `[~]` = in progress

---

## CRITICAL Security

- [x] **#1** Fix CORS wildcard — restrict to configured origins (`Program.cs:109`)
- [x] **#2** Remove hardcoded encryption key fallback (`Program.cs:80`)
- [x] **#3** Replace weak AES key derivation with PBKDF2 (`ConnectionService.cs:193`)
- [x] **#4** Fix SQL injection via sort column (`QueryExecutorBase.cs:37`)

## HIGH Security

- [x] **#5** Add rate limiting middleware (auth: 10/min, query: 60/min, global: 200/min)
- [x] **#6** Implement query execution audit log (`QueryService.cs:200` stub)
- [x] **#7** Fix embed token audit — replace `Guid.Empty` (`EmbedEndpoints.cs:144`)
- [x] **#8** Add HTTPS enforcement and HSTS (`Program.cs`)
- [x] **#9** Add Redis authentication to Docker Compose
- [x] **#10** Remove default SA password from Docker Compose

## MEDIUM Security

- [x] **#11** Add security headers to nginx (CSP, X-Frame-Options, etc.)
- [x] **#12** Add JWT token blacklist (Redis JTI set on logout)
- [x] **#13** Fix MongoDB aggregation injection (operator whitelist)
- [x] **#14** Switch JWT to RS256 asymmetric keys

## Features

- [x] **#15** Add per-query timeout maximum enforcement (`QueryServiceOptions`)
- [x] **#16** Make paginated COUNT opt-in (`IncludeTotalCount` flag)
- [x] **#17** Implement report execution history endpoint (`GET /api/reports/{id}/history`)
- [x] **#18** Implement ingest dataset preview (real SQL query, returns rows)
- [x] **#19** Wire up scheduled report execution (`ScheduledReportConsumer` + `POST /api/reports/{id}/schedule`)
- [x] **#20** Add per-user concurrent query limit (Redis semaphore)
- [x] **#21** Add upload file size enforcement (`MaxUploadSizeMb` config)
- [x] **#22** Add full-text search to report catalog (`?q=` filter)
- [x] **#23** Row-level security (mandatory WHERE injection via `RowFilterExpression` per report)
- [x] **#24** Column-level masking / hiding (`ColumnMaskingRule`: None/Hidden/Masked/Partial)
- [ ] **#25** Multi-report dashboard builder

## Performance

- [x] **#26** Streaming CSV export (`POST /api/export/csv/stream` — async enumerable, flushes every 1000 rows)
- [x] **#27** Add query EXPLAIN endpoint (`POST /api/query/explain`)
- [x] **#28** Cache invalidation endpoint (`POST /api/query/cache/{reportId}/invalidate`)

## Observability

- [x] **#29** Add correlation ID middleware (X-Correlation-ID propagation)
- [x] **#30** Fix fragile audit middleware entity extraction (use HttpContext.Items)
- [x] **#31** Add request body / field-diff to audit log (up to 64KB, sensitive fields redacted)
- [x] **#32** Add OpenTelemetry metrics + Prometheus `/metrics` endpoint
- [x] **#33** Add alerting rules (error rate, p95 latency, DB unavailable)

## Infrastructure

- [x] **#34** Add Application Insights to Bicep infra
- [x] **#35** Parameterize Bicep SKUs by environment (dev/staging/prod)
- [x] **#36** Add WAF / Azure Front Door to Bicep
- [x] **#37** Add private endpoints for SQL, Redis, Storage in Bicep (prod-only, requires pre-provisioned VNet)
- [x] **#38** Add database backup configuration (PITR / backup schedule)
- [x] **#39** Add Container App readiness probes (`/health/ready`)

## Frontend

- [x] **#40** Move tokens from localStorage to HttpOnly cookie (`kinetic_access_token`, `kinetic_refresh_token`)
- [x] **#41** Refresh token system fully implemented (backend: store, validate, rotate, revoke)
- [x] **#42** Add client-side form validation (react-hook-form + zod on Login, Register, ConnectionForm)
- [ ] **#43** Mobile responsive layout (Tailwind breakpoints)

## Testing

- [x] **#44** Unit test projects (`Kinetic.Core.Tests` — 142 tests passing)
- [x] **#45** Add API integration tests (`Kinetic.Api.IntegrationTests` — auth endpoint tests with WebApplicationFactory)
- [x] **#46** Add k6 load test scripts (`/load-tests/query-load-test.js`)
- [ ] **#47** Add Playwright E2E specs (`ui/e2e/`)
- [ ] **#48** Increase frontend unit test coverage to 60%+ for hooks/stores

---

*Cross-reference: see `gap.md` for full analysis and rationale per item.*
