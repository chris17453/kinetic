# Kinetic — Gap Analysis

> Last updated: 2026-02-22
> Platform: Multi-tenant reporting platform (.NET 10 API / React 18 / Azure)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Security](#security)
3. [Features & Functionality](#features--functionality)
4. [Performance & Scale](#performance--scale)
5. [Observability & Ops](#observability--ops)
6. [Infrastructure & Deployment](#infrastructure--deployment)
7. [Frontend](#frontend)
8. [Testing](#testing)
9. [Priority Matrix](#priority-matrix)

---

## Executive Summary

Kinetic is a well-architected system with good separation of concerns, a comprehensive adapter model, and solid foundational auth. That said, several **critical security issues** must be resolved before any production deployment. Performance and scaling concerns are manageable but require attention as load grows. A number of features are stubbed or incomplete.

**Overall score: 7/10** — Good bones, needs security hardening and gap-filling before shipping.

---

## Security

### CRITICAL

#### 1. CORS Allows Any Origin
**File**: `src/Kinetic.Api/Program.cs:109`
```csharp
policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
```
Opens every API endpoint to cross-origin requests from any attacker-controlled domain. Enables CSRF, credential theft, and data exfiltration.
**Fix**: Load allowed origins from config (`Cors:AllowedOrigins`), use `WithOrigins(...)` + `AllowCredentials()`.

---

#### 2. Hardcoded Encryption Key Fallback
**File**: `src/Kinetic.Api/Program.cs:80`
```csharp
var key = config["EncryptionKey"] ?? "default-dev-encryption-key-32ch";
```
Any deployment that forgets to set `EncryptionKey` silently uses the known default. Every connection string in the database becomes trivially decryptable.
**Fix**: Throw `InvalidOperationException` if the key is missing. Never fall back to a constant.

---

#### 3. Weak AES Key Derivation
**File**: `src/Kinetic.Api/Services/ConnectionService.cs:193`
Key is derived by string padding/truncation instead of a proper KDF. Weak entropy, no salt, vulnerable to brute-force.
**Fix**: Replace with `Rfc2898DeriveBytes` (PBKDF2, ≥100k iterations, random salt stored alongside ciphertext) or AES-GCM via .NET `AesGcm`.

---

#### 4. SQL Injection via Sort Column
**File**: `src/Kinetic.Adapters/Core/QueryExecutorBase.cs:37`
`request.SortColumn` is user input directly interpolated into the final SQL string. Paginated wrappers in both `PostgreSqlQueryExecutor` and `SqlServerQueryExecutor` pass this value verbatim.
**Fix**: Validate `SortColumn` against the column list returned by the schema/detect-columns route; reject or quote-escape any value not on the whitelist.

---

#### 5. System Variable String Replacement (Unparameterized)
**File**: `src/Kinetic.Adapters/Core/QueryExecutorBase.cs:218`
`{{TODAY}}`, `{{NOW}}`, etc. are substituted via string replace, not parameterized. If the substitution logic ever changes or a variable value can be influenced externally, it becomes an injection vector.
**Fix**: Replace system variable substitution with parameterized bindings (`@sys_today`, etc.) added to the DbCommand parameters collection.

---

### HIGH

#### 6. No Rate Limiting
No rate limiting exists on any endpoint — auth, query execution, or export. Exposes the app to brute-force credential stuffing, resource exhaustion via expensive queries, and denial of service.
**Fix**: Add `Microsoft.AspNetCore.RateLimiting` (sliding window on `/api/auth`, fixed window on `/api/query`) or use nginx `limit_req`.

---

#### 7. Query Execution Audit Log Is a Stub
**File**: `src/Kinetic.Api/Services/QueryService.cs:200`
```csharp
// Could log to AuditLog table or separate QueryHistory table
// For now, just a placeholder
```
No query execution is ever recorded. This is a compliance blocker for any regulated industry and prevents forensic investigation of data access.
**Fix**: Persist `QueryHistory` rows (user, report, connection, hash, row count, duration, timestamp) inside `LogQueryExecutionAsync`.

---

#### 8. Embed Execution Uses `Guid.Empty` as User ID
**File**: `src/Kinetic.Api/Endpoints/EmbedEndpoints.cs:144`
All queries executed via embed tokens are attributed to `Guid.Empty`. No audit trail, no quota enforcement, no per-token metrics.
**Fix**: Store the `CreatedByUserId` on the embed token; use that ID (or a synthetic service-account GUID) for audit rows.

---

#### 9. No HTTPS Enforcement in Application Code
No `UseHsts()` or `UseHttpsRedirection()` in `Program.cs`. Relies solely on nginx/infra to enforce HTTPS. A direct-to-API request over HTTP is never redirected.
**Fix**: Add `app.UseHsts(); app.UseHttpsRedirection();` guarded by `!app.Environment.IsDevelopment()`.

---

#### 10. JWT Uses Symmetric Key (HS256)
Any service that needs to validate tokens must hold the shared secret, making secret rotation painful and expanding the blast radius if the key leaks.
**Fix**: Switch to RS256 — API signs with private key, consumers validate with public key. Store keys in Azure Key Vault.

---

### MEDIUM

#### 11. JWT Token Blacklist Not Enforced
Revoked/logged-out tokens remain valid until expiry. No server-side token invalidation list.
**Fix**: On logout, write the JTI to a Redis set with TTL = token expiry. Validate JTI against that set on every request.

---

#### 12. No Content Security Policy
No CSP headers returned by either the API or nginx. XSS in the React app has no browser-level containment.
**Fix**: Add CSP header in `nginx.conf` scoped to `script-src 'self'`, `connect-src` pointing at known API origin, `frame-ancestors 'none'` (unless embed intentionally allows iframing).

---

#### 13. Missing Security Headers in Nginx
**File**: `docker/nginx.conf`
None of the standard defensive headers are set.
**Fix**:
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

---

#### 14. MongoDB Aggregation Injection
**File**: `src/Kinetic.Adapters/MongoDB/MongoDbAdapter.cs:410`
User-supplied aggregation pipeline stages are deserialized and passed to the driver with minimal validation. An attacker with connection access could inject `$out`, `$merge`, or `$lookup` stages exfiltrating or overwriting data.
**Fix**: Validate or whitelist allowed top-level pipeline operators; reject `$out`, `$merge`, `$indexStats`, `$collStats`.

---

#### 15. Redis Has No Authentication
**File**: `docker/docker-compose.prod.yml`
Redis is started with no password. Any process on the Docker network can read/write the query result cache.
**Fix**: Add `command: redis-server --requirepass ${REDIS_PASSWORD}` and pass the password in the connection string.

---

#### 16. SA Password Default in Compose
**File**: `docker/docker-compose.prod.yml`
```yaml
MSSQL_SA_PASSWORD: KineticDev123!
```
Likely committed and used as a copy-paste default. SA is the highest-privilege SQL Server account.
**Fix**: Generate a random password, inject via `.env` or Docker Secrets, never commit a default.

---

## Features & Functionality

### Not Implemented / Stubbed

| Feature | Location | Status | Priority |
|---|---|---|---|
| Query execution history | `QueryService.cs:200` | Placeholder comment | HIGH |
| Ingest dataset preview | `IngestEndpoints.cs:154` | Returns `PreviewAvailable: false` | MEDIUM |
| Scheduled report execution | `ScheduledReportConsumer` (queue infra only) | Queue wired, UI/handler missing | MEDIUM |
| Per-user query concurrency limit | No implementation | Not present | MEDIUM |

---

### Missing Features (Not Started)

#### Row-Level Security
No mechanism exists to filter rows based on the requesting user. Multi-tenant reports must embed tenant ID as a required parameter — easy to bypass.
**Fix**: Add `RowFilterPolicy` on a report/connection: inject a mandatory `WHERE tenant_id = @CurrentUserId` predicate that callers cannot override.

#### Column-Level Security / Data Masking
All columns are returned to all authorized users. No masking of PII (SSNs, emails, phone numbers).
**Fix**: Add column-level permission overrides (Hide, Mask, Allow) on the `ColumnDefinition` model. Apply in `QueryService` before returning results.

#### Multi-Report Dashboard Builder
Only single-report views exist. There is no layout canvas to compose multiple reports/charts into a dashboard.
**Fix**: Add `Dashboard` entity with `DashboardWidget[]` (reportId, x, y, w, h, parameterBindings). Render with a grid layout library (react-grid-layout).

#### Full-Text Search for Reports/Catalog
The catalog page filters by category and owner but there is no full-text search across report name, description, or SQL content.
**Fix**: Add `CONTAINS` / `tsvector` search to the report list query, expose as `?q=` filter.

#### Report Execution History / Usage Analytics
No `ReportExecutionLog` table. No way to see which reports are used, by whom, or how often.
**Fix**: Implement `LogQueryExecutionAsync` + add an `/api/reports/{id}/history` endpoint.

#### Automatic Cache Invalidation
Cache is TTL-only. If source data changes mid-TTL the stale result is served.
**Fix**: Add a `POST /api/query/cache/{reportId}/invalidate` endpoint, call it from ingest/upload completion events.

#### Data Refresh / Scheduled Cache Warming
No scheduled re-execution to keep cache fresh before peak usage.
**Fix**: Extend `ScheduledReportConsumer` to write results into the cache ahead of user requests.

#### Upload File Size Enforcement
No explicit max upload size check; falls back on ASP.NET Core's 30 MB default silently.
**Fix**: Add `MaxUploadSizeMb` to config and enforce with `[RequestSizeLimit]` or middleware.

#### Concurrent Query Limit Per User
A single user can open unlimited parallel queries, potentially monopolizing connection pool.
**Fix**: Add a per-user semaphore tracked in Redis (`kinetic:qlimit:{userId}`), return `429 Too Many Requests` when exceeded.

---

## Performance & Scale

### Query Execution

#### Full Table COUNT on Every Paginated Request
Every paginated query wraps the inner SQL in `SELECT COUNT(*)`. On large tables this can be as expensive as the data query itself.
**Fix**: Make total count opt-in (`IncludeTotalCount: false` default). When disabled, return `totalRows: null`. Alternatively use table statistics as an estimate.

#### No Per-Query Timeout Maximum
Timeout is configurable but there is no enforced maximum. A user can submit a 24h timeout and hold a connection open indefinitely.
**Fix**: Add `MaxQueryTimeoutSeconds` in `QueryServiceOptions`. Clamp `request.TimeoutSeconds` to that ceiling.

#### Streaming Export Not Implemented
Excel and PDF export load the entire result set into memory before writing. On results near the 100k row limit this is a significant memory spike.
**Fix**: Use `ClosedXML.Excel` streaming writer or EPPlus streaming API for Excel; iTextSharp streaming for PDF.

#### No Query Plan / Cost Estimation
No `EXPLAIN` / `EXPLAIN ANALYZE` surfaced to users or the AI layer.
**Fix**: Add `POST /api/query/explain` that returns the query plan as text/JSON. Useful for debugging slow reports.

---

### Caching

#### No Cache Warming
First request after deploy or TTL expiry always hits the source DB cold.
**Fix**: Pre-warm high-priority report caches on deploy via a startup job.

#### Redis Single Instance
**File**: `docker/docker-compose.prod.yml`, `infra/bicep/modules/redis.bicep`
Redis is a single point of failure for both the query cache and the MassTransit message queue.
**Fix**: Use Redis Sentinel (self-hosted) or Azure Cache for Redis with zone redundancy + geo-replication for active/active.

---

### Database

#### System DB Has No Replication
The MSSQL system database has no mention of Always-On, replication, or failover. It holds all user, report, and connection data.
**Fix**: Configure SQL Server Always-On Availability Group or use Azure SQL with Business Critical tier + read replicas.

#### No Connection Pool Tuning
All adapters use default `DbConnection` pooling. Under high load the default max pool size (100) will be hit.
**Fix**: Expose `MinPoolSize`, `MaxPoolSize` per connection in the connection settings model. Log pool exhaustion warnings.

---

### Ingest

#### Single TCP Listener — Not Horizontally Scalable
**File**: `src/Kinetic.Ingest` (port 9999)
The ingest server is a single TCP listener. Multiple API replicas each try to bind 9999, causing port conflicts.
**Fix**: Move ingest to a dedicated service (separate container). Use a load balancer or message queue front-end for volume.

---

## Observability & Ops

### No Distributed Tracing / Correlation IDs
Requests across API → Adapter → Queue have no shared trace ID. Debugging cross-service failures is blind.
**Fix**: Add `X-Correlation-ID` header middleware; propagate via `Activity` / OpenTelemetry. Export to Azure Monitor or Jaeger.

### No Application Metrics
No request latency histograms, cache hit ratios, query duration percentiles, or error rate counters published.
**Fix**: Add `prometheus-net` or OpenTelemetry metrics. Expose `/metrics` endpoint. Scrape with Prometheus; dashboard in Grafana.

### No Alerting
No alerts exist for error rate spikes, slow queries, or DB connection failures.
**Fix**: Define alert rules in Azure Monitor (or Prometheus Alertmanager): p95 query latency > 10s, error rate > 1%, DB unavailable.

### Audit Log Entity Extraction Is Fragile
**File**: `src/Kinetic.Api/Middleware/AuditLoggingMiddleware.cs:94`
Entity type is inferred from URL path by string matching. Nested routes (e.g. `/api/users/{id}/groups`) misclassify the entity.
**Fix**: Set entity type/id on `HttpContext.Items` inside endpoint handlers instead of parsing paths in middleware.

### Audit Log Has No Request Body / Diff
The audit log records the HTTP verb and path but not what data was changed (no before/after values).
**Fix**: For mutating operations, log a redacted JSON body or use EF Core's `ChangeTracker` to record field-level diffs.

### Serilog Uses String Interpolation in Several Paths
Some log calls use `$"string {value}"` instead of structured `_logger.LogError(ex, "Failed for {Entity}", value)`. This loses structured property indexing.
**Fix**: Switch all log statements to message templates with named properties.

---

## Infrastructure & Deployment

### No WAF / DDoS Protection
Neither the Docker nor Azure Bicep deployment puts a Web Application Firewall in front of the API. The API is directly internet-accessible.
**Fix**: Add Azure Front Door + WAF policy (OWASP rule set) in front of the Container App. Or use Application Gateway with WAF v2.

### No Private Endpoints for Data Services
**File**: `infra/bicep/`
SQL Server, Redis, and Storage are accessible over public endpoints.
**Fix**: Add `Microsoft.Network/privateEndpoints` for each service; restrict public network access to `Disabled`.

### No Application Insights / Azure Monitor
**File**: `infra/bicep/main.bicep`
No Application Insights resource is provisioned. No live metrics, failure analysis, or distributed tracing in Azure.
**Fix**: Add `microsoft.insights/components` to the Bicep template. Inject the instrumentation key into Container App environment variables.

### No Database Backup Configuration
No backup policy, retention, or point-in-time restore is configured in the Bicep or Docker Compose.
**Fix**: Enable PITR on Azure SQL (default 7-day, increase to 35 for production). For Docker, add a backup sidecar (e.g. SQL Server backup to Azure Blob).

### Resource SKUs Are Not Parameterized by Environment
**File**: `infra/bicep/main.bicep`
Production-grade SKUs are hardcoded. Dev environments cost as much as production.
**Fix**: Add an `environmentName` parameter (`dev`/`staging`/`prod`). Map to different SKUs per tier.

### No Health Check Readiness in Bicep
Container Apps have no `readinessProbe` defined. New revisions receive traffic before they're ready.
**Fix**: Add readiness probes pointing to `/health/ready` on each Container App.

---

## Frontend

### Tokens Stored in `localStorage`
**File**: `ui/src/stores/authStore.ts:33`
JWT access tokens are persisted in `localStorage`, which is accessible to any JavaScript on the page. An XSS vulnerability anywhere in the app (or a third-party script) can steal tokens.
**Fix**: Serve tokens via `Set-Cookie: HttpOnly; Secure; SameSite=Strict`. Implement a `/api/auth/me` endpoint that the frontend calls on load instead of reading from storage.

### No Silent Token Refresh
When the access token expires the user is silently dropped to the login page. No refresh-token flow runs in the background.
**Fix**: Add an Axios request interceptor that on 401 fires `POST /api/auth/refresh`, retries the original request with the new token, and only redirects to login if refresh fails.

### No Client-Side Form Validation
All validation is deferred to the API. Users get errors only after a round-trip.
**Fix**: Add `react-hook-form` + `zod` schemas on the most-used forms (report builder, connection form, parameter builder).

### No Mobile / Responsive Layout
The UI is desktop-only. Viewing reports or the admin panel on mobile is broken.
**Fix**: Add Tailwind responsive breakpoints (`sm:`, `md:`) to the layout shell, data tables, and chart renderers. Consider a separate mobile view for report consumption.

### No Offline / Service Worker
Network interruptions cause blank screens. No caching of previously-viewed reports.
**Fix**: Add a Vite PWA plugin with a network-first strategy for API calls and cache-first for static assets. Store last N report results in IndexedDB for offline viewing.

---

## Testing

### No Test Projects Found in Repo
Plan.md marks Phase 17 (Testing) as complete, but no `.Tests.csproj` files or test directories are visible in the committed codebase.
**Gap**: Unknown coverage. Cannot verify correctness of adapter logic, auth flows, or permission checks without tests.
**Fix**: Commit unit tests (`Kinetic.Core.Tests`, `Kinetic.Adapters.Tests`) and integration tests (`Kinetic.Api.IntegrationTests`) to the repo.

### No Load / Stress Testing
No k6, Locust, or NBomber scripts exist. No baseline performance benchmarks.
**Fix**: Add a `/load-tests/` directory with k6 scripts for the query execution, auth, and report list endpoints. Run as part of CI on a staging environment.

### No E2E Tests Committed
Plan.md mentions Playwright (Phase 20) but no spec files are present.
**Fix**: Add `ui/e2e/` with Playwright specs covering the login → connection → report create → execute flow.

### Frontend Unit Test Coverage Is Minimal
Only two test files exist: `ExportButton.test.tsx` and `ParameterInputs.test.tsx`. No tests for hooks, stores, or complex components (VisualizationBuilder, QueryAssistant).
**Fix**: Target 60%+ coverage for hooks (`useQueryExecution`, `usePermissions`) and the report builder flow.

---

## Priority Matrix

| # | Gap | Area | Severity | Effort |
|---|-----|------|----------|--------|
| 1 | CORS allows any origin | Security | Critical | Small |
| 2 | Hardcoded encryption key fallback | Security | Critical | Small |
| 3 | Weak AES key derivation | Security | Critical | Medium |
| 4 | SQL injection via sort column | Security | Critical | Small |
| 5 | No rate limiting | Security | High | Small |
| 6 | Query audit log is a stub | Features | High | Medium |
| 7 | Embed uses Guid.Empty for audit | Security | High | Small |
| 8 | No HTTPS enforcement in code | Security | High | Small |
| 9 | Redis no auth | Security | High | Small |
| 10 | SA password default in compose | Security | High | Small |
| 11 | No JWT blacklist | Security | Medium | Medium |
| 12 | No CSP / security headers | Security | Medium | Small |
| 13 | MongoDB aggregation injection | Security | Medium | Medium |
| 14 | Tokens in localStorage | Frontend | Medium | Medium |
| 15 | No silent token refresh | Frontend | Medium | Medium |
| 16 | Full COUNT on every paginated query | Performance | Medium | Small |
| 17 | No per-query timeout maximum | Performance | Medium | Small |
| 18 | Streaming export not implemented | Performance | Medium | Large |
| 19 | Redis single instance | Scale | Medium | Medium |
| 20 | System DB no replication | Scale | Medium | Large |
| 21 | Row-level security missing | Features | Medium | Large |
| 22 | Column masking missing | Features | Medium | Large |
| 23 | No dashboard builder | Features | Medium | XL |
| 24 | Report execution history missing | Features | Medium | Medium |
| 25 | No distributed tracing | Observability | Medium | Medium |
| 26 | No metrics / alerting | Observability | Medium | Medium |
| 27 | No Application Insights in Bicep | Infra | Medium | Small |
| 28 | No WAF / DDoS protection | Infra | Medium | Small |
| 29 | No private endpoints | Infra | Medium | Medium |
| 30 | Ingest not horizontally scalable | Scale | Low | Large |
| 31 | No test projects committed | Testing | High | Large |
| 32 | No load testing | Testing | Medium | Medium |
| 33 | Minimal frontend test coverage | Testing | Medium | Large |
| 34 | No mobile responsive UI | Frontend | Low | XL |

---

*Generated via automated codebase analysis + manual review.*
