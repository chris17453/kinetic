# Kinetic Handoff State

Last updated: 2026-06-30

## Current Goal

Build Kinetic into a Power BI-style BI workspace while keeping the app local-first. Azure, Entra ID, Azure DevOps, and external SSO integrations are important enterprise features, but they must not block local username/password login or local development.

The current strategic decision is to continue building on the existing React + .NET app rather than starting a full rewrite. Python remains a possible future service for data prep/semantic execution, not a current blocker.

## Running Local Services

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000`
- SQL Server and Redis are expected to be running locally via Docker.
- Latest known API process after restart: `Kinetic.Api` listening on port `5000`.
- Latest known Vite process: `node` listening on port `5173`.

API local environment used when starting:

```bash
ASPNETCORE_URLS=http://localhost:5000 \
ConnectionStrings__DefaultConnection='Server=localhost,1433;Database=Kinetic;User Id=sa;Password=Kinetic@Dev123!;TrustServerCertificate=True' \
Redis__ConnectionString='localhost:6379' \
Encryption__Key='dev-encryption-key-32-chars-ok!!' \
Jwt__Secret='dev-jwt-secret-at-least-32-characters-long' \
Jwt__Issuer='kinetic' \
Jwt__Audience='kinetic-users' \
dotnet run --project src/Kinetic.Api/Kinetic.Api.csproj --no-build --no-launch-profile
```

Useful port check:

```bash
ss -ltnp | awk '/:5000|:5173/ {print}'
```

## Verification Status

Last verification passed:

```bash
dotnet build Kinetic.slnx --no-restore
dotnet test tests/Kinetic.Api.IntegrationTests/Kinetic.Api.IntegrationTests.csproj --no-restore --logger "console;verbosity=minimal"
npm run build
```

Integration tests passed: 17/17.

Known warning categories:

- NuGet package vulnerability warnings across several projects.
- `ConnectionService` PBKDF2 constructor obsolete warnings.
- EF value-converter collection warnings for JSON/list-backed properties.
- A transient test DLL copy retry can appear if build/test run concurrently; it completed successfully.

Smoke checks passed:

- `GET /api/auth/entra/config` returns `enabled:false` when no Entra config exists.
- `POST /api/auth/login` reaches the API locally and returns normal credential validation errors instead of connection refused.
- Unauthenticated protected refresh schedule endpoints return `401`.

## Database / Migrations

The local SQL Server database has been updated through:

- `AddWorkspaces`
- `AddDatasets`
- `AddReportDatasets`
- `AddDashboards`
- `AddSystemIntegrations`
- `AddRefreshJobsAndDatasetCertification`
- `AddWorkspaceMembers`
- `AddUserApiTokens`
- `AddUserConnectedAccounts`
- `AddRefreshSchedules`

The latest migration applied locally was:

```bash
ConnectionStrings__DefaultConnection='Server=localhost,1433;Database=Kinetic;User Id=sa;Password=Kinetic@Dev123!;TrustServerCertificate=True' \
dotnet ef database update --project src/Kinetic.Data --startup-project src/Kinetic.Api --no-build
```

Important migration caveat:

- The broad `AddWorkspaces` migration includes accumulated model snapshot drift, not only workspace tables. Review against a real database backup before production rollout.

## Major Functional State

### Local Auth And Identity

Local login/register remains the baseline path and does not depend on Azure or Entra.

Implemented:

- JWT local auth continues to work.
- User profile endpoints and UI for profile details, preferences, notification settings, password changes, groups, active sessions, session revocation, API tokens, and connected accounts.
- API tokens are hashed and plaintext is only returned once at creation.
- Connected-account records exist for Microsoft Entra ID, Azure DevOps, Azure, OIDC, SAML, service-principal/system-login, and custom providers.
- Microsoft Entra/OIDC login plumbing exists:
  - `/api/auth/entra/config`
  - `/api/auth/entra`
  - `/api/auth/entra/callback`
  - React `/auth/callback`
  - ID token validation, local user upsert, connected-account stamping, and external group claim mapping by `Group.ExternalId`.
- Entra config can come from global identity `SystemIntegration` records with `env:`, `config:`, or `literal:` secret references.

Remaining:

- Provider OAuth handshakes beyond Entra.
- SCIM/user provisioning.
- Role-claim mapping hardening.
- Logout/session federation.
- MFA/conditional-access documentation and login policy controls.
- Key Vault or encrypted secret resolution beyond current secret-reference handling.

### Enterprise Integrations

Implemented:

- Provider-neutral `SystemIntegration` domain model/API/UI.
- Integration providers/categories include Microsoft Entra ID, Azure DevOps, Azure platform, OIDC, SAML, service-principal/system-login, and custom.
- Provider-aware validation exists for Entra/OIDC, Azure DevOps, Azure platform, service-principal/system-login, and SAML.
- OIDC discovery probing is available via `settings.validateDiscovery`.
- Integration update no longer wipes omitted settings/secrets/tenant/client/authority fields.

Remaining:

- Azure DevOps work item links, report issue capture, release/deployment traceability.
- Azure platform workflows for Key Vault, managed identity, storage, App Insights/Log Analytics, Azure SQL/Synapse/Fabric shortcuts.
- Credential rotation, system-login binding for scheduled refresh, and machine-login audit views.

### Workspaces And Governance

Implemented:

- Workspace domain/API/UI.
- Workspace list/detail/create/update/archive/default.
- Workspace member CRUD with viewer, contributor, member, admin roles.
- Workspace-aware permissions across datasets, reports, dashboards, connections, integrations, refresh jobs, and schedules.
- Workspace counts for dashboards, reports, datasets, and connections.

Remaining:

- Share dialog for users/groups/links.
- Content lifecycle: draft/published or dev/test/prod.
- Version history and rollback.
- Endorsement/promoted/certified workflows beyond dataset certification.
- Usage analytics and tenant admin controls.

### Datasets / Semantic Model

Implemented:

- Dataset domain model/API/UI.
- Dataset source can reference connection/query/table.
- Semantic metadata: tables, fields, measures, relationships, hierarchies.
- Dataset inspect source action.
- Dataset detail view with metadata, fields, measures, lineage, linked reports, generated SQL, sample row preview, certification controls, refresh queueing, refresh schedules, and refresh history.
- Dataset-backed report builder path with semantic field picker and generated SQL.
- `POST /api/datasets/{id}/query` generates SQL from selected dimensions/measures.

Remaining:

- Persisted visual field wells.
- Calculated columns and expression validation/sandboxing.
- Rich relationship authoring and validation.
- True self-service semantic authoring comparable to Power BI.
- Implicit migration path from existing SQL reports to hidden/implicit datasets.

### Reports / Catalog / Viewer

Implemented:

- Report DTO contract alignment for UI: execution mode, auto-run, cache mode, embed, tags, visibility, category, connection, favorite/rating metadata, ownership, dataset metadata.
- Catalog filters: tags, tag, scope, visibility, order, sort direction, favorites, ratings, tags lookup.
- Rating and tags endpoints.
- Report builder save/load mapping for backend-compatible visualization discriminators.
- Report preview via query preview endpoint.
- Report-scoped execute/export endpoints.
- CSV export integration coverage.
- Dataset-backed report creation and semantic query generation coverage.

Remaining:

- Excel/PDF export coverage.
- Shared/generated DTOs to stop React/.NET drift.
- Frontend E2E tests.
- Cache metadata true-hit alignment.
- Persisted visual field wells and multi-visual report canvas.

### Dashboards / Canvas

Implemented:

- Dashboard domain/API/UI.
- Dashboard management page.
- Dashboard canvas editor route with persisted grid coordinates.
- Report visual pinning, KPI/text widgets, move/resize controls.

Remaining:

- Polished drag/drop library behavior.
- Dashboard viewer mode.
- Dashboard-level filters and parameter bindings.
- Cross-filtering/cross-highlighting.
- Visual container actions: fullscreen, export, copy, refresh, inspect data.

### Refresh / Scheduling / Operations

Implemented:

- `RefreshJob` domain model for dataset/report/dashboard refresh history.
- Refresh job endpoints:
  - list/filter
  - queue
  - complete
- Dataset refresh completion updates `LastRefreshedAt`.
- `RefreshSchedule` domain model, EF mapping, migration, and API:
  - `GET /api/refresh-jobs/schedules`
  - `POST /api/refresh-jobs/schedules`
  - `PUT /api/refresh-jobs/schedules/{id}`
  - `DELETE /api/refresh-jobs/schedules/{id}`
  - `POST /api/refresh-jobs/schedules/run-due`
- Dataset detail UI for recurring schedules: create, enable/disable, delete, next-run display.
- Simple 5-field cron support:
  - `*`
  - exact values
  - ranges
  - steps like `*/15`
  - comma lists
- `RefreshScheduleHostedService` evaluates due schedules and queues scheduled refresh jobs.
- `RefreshJobProcessor` and `RefreshJobHostedService` process queued jobs:
  - `Queued -> Running -> Succeeded/Failed`
  - dataset refresh validates source query/table and stamps `LastRefreshedAt`
  - report refresh executes sample report query
  - dashboard refresh validates pinned report execution
  - failures are recorded in job `Message`
- Legacy scheduled publishers in `ScheduledJobsHostedService` are now opt-in to avoid MassTransit DI fault loops for unregistered old services.

Remaining:

- Global refresh operations page.
- User-facing failed refresh alerts.
- True materialized dataset/dataflow refresh engine.
- Incremental refresh policy.
- Dependency-aware refresh ordering.
- Gateway/agent story for private networks.
- Timezone-aware cron calculation. Timezone is currently stored/displayed; next-run calculation is UTC.

## Files Added Or Heavily Touched

Key added files:

- `src/Kinetic.Api/Endpoints/WorkspaceEndpoints.cs`
- `src/Kinetic.Api/Endpoints/DatasetEndpoints.cs`
- `src/Kinetic.Api/Endpoints/DashboardEndpoints.cs`
- `src/Kinetic.Api/Endpoints/IntegrationEndpoints.cs`
- `src/Kinetic.Api/Endpoints/RefreshEndpoints.cs`
- `src/Kinetic.Api/Services/RefreshScheduleRunner.cs`
- `src/Kinetic.Core/Domain/Workspaces/`
- `src/Kinetic.Core/Domain/Datasets/`
- `src/Kinetic.Core/Domain/Dashboards/`
- `src/Kinetic.Core/Domain/Integrations/`
- `src/Kinetic.Core/Domain/Refresh/`
- `src/Kinetic.Core/Domain/Identity/UserApiToken.cs`
- `src/Kinetic.Core/Domain/Identity/UserConnectedAccount.cs`
- `src/Kinetic.Data/KineticDbContextFactory.cs`
- `ui/src/pages/Workspaces/`
- `ui/src/pages/Datasets/`
- `ui/src/pages/Dashboards/`
- `ui/src/pages/Admin/IntegrationsPage.tsx`
- `ui/src/pages/Auth/AuthCallbackPage.tsx`
- `tests/Kinetic.Api.IntegrationTests/Workspaces/`
- `tests/Kinetic.Api.IntegrationTests/Datasets/`
- `tests/Kinetic.Api.IntegrationTests/Dashboards/`
- `tests/Kinetic.Api.IntegrationTests/Integrations/`
- `tests/Kinetic.Api.IntegrationTests/Refresh/`

Important existing files modified:

- `src/Kinetic.Api/Program.cs`
- `src/Kinetic.Data/KineticDbContext.cs`
- `src/Kinetic.Queue/Services/ScheduledJobsHostedService.cs`
- `src/Kinetic.Identity/Services/AuthService.cs`
- `src/Kinetic.Api/Endpoints/AuthEndpoints.cs`
- `src/Kinetic.Api/Endpoints/UserEndpoints.cs`
- `src/Kinetic.Api/Endpoints/ReportEndpoints.cs`
- `src/Kinetic.Api/Endpoints/ConnectionEndpoints.cs`
- `ui/src/App.tsx`
- `ui/src/components/layout/AppLayout.tsx`
- `ui/src/lib/api/types.ts`
- `ui/src/pages/Profile/ProfilePage.tsx`
- `ui/src/pages/Reports/ReportBuilderPage.tsx`
- `plans/plan.md`

## Immediate Next Priorities

1. Build a global refresh operations page with filters for target type, status, workspace, failed jobs, and stale datasets.
2. Add failed-refresh alerts/notifications and visible failure reasons in dataset/report/dashboard detail pages.
3. Build dashboard viewer mode and cross-filtering on top of the current canvas editor.
4. Persist report/visual field wells instead of only storing generated SQL.
5. Add shared/generated API DTOs for React/.NET contract stability.
6. Add frontend E2E coverage for auth, catalog, builder, viewer execute/export, workspace, dataset, dashboard, profile/security, integrations, and refresh schedules.
7. Harden identity/integration work without blocking local login: Key Vault/encrypted secrets, provider OAuth beyond Entra, SCIM, role claims, system-login binding.
8. Add Azure DevOps work item/release traceability.
9. Review broad migrations against a real DB backup before production use.
10. Decide later whether Python is required for data prep/materialization or only useful as a supporting service.

## Do Not Break

- Local username/password login must keep working even when Entra/Azure is unconfigured.
- Entra/Azure should stay optional and report disabled/unconfigured cleanly.
- Do not revert unrelated dirty worktree changes.
- Do not make Azure/Entra/Azure DevOps a prerequisite for local refresh, local datasets, or local report creation.

