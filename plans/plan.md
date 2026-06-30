# Kinetic Power BI-Style Gap Analysis and Plan

Last updated: 2026-06-30

## Executive Summary

Kinetic is not a blank slate. It already has a meaningful BI foundation: React/Vite UI, .NET API, auth and permissions, database connections, SQL execution, workspaces, datasets, semantic metadata, report catalog, report builder, visualizations, exports, embeddings, upload/ingest paths, queue infrastructure, audit logs, and deployment assets.

The current product is moving from a SQL-first reporting platform toward an enterprise BI workspace. It now has initial workspace, dataset, semantic-model, report-to-dataset, and dashboard foundations, but it does not yet have the full Power BI/enterprise platform experience: drag-and-drop report canvases, persisted visual field wells, reusable dashboard layouts, cross-filtering, rich relationship authoring, data prep/dataflows, workspace governance, sharing workflows, refresh orchestration, Azure/SSO identity integration, Azure DevOps lifecycle integration, system-login integrations, and end-user consumption polish.

Recommendation: do not start a full rewrite yet. Keep the existing app as the foundation, but treat the next phase as a productization pass plus a BI-modeling expansion. A full new app only makes sense if Python is a hard backend requirement or if the first contract-stabilization sprint shows the current API/UI/domain mismatch is too deep to repair economically.

## Current State

### What Exists

- React/Vite frontend with lazy-loaded routes, authenticated app shell, sidebar navigation, global search modal, breadcrumbs, toast provider, and error boundaries.
- .NET API with minimal endpoints for auth, users, groups, connections, reports, query execution, exports, embeds, ingest, metrics, and admin areas.
- Local user profile/auth flows plus organization/user/group administration foundations.
- Database adapters for PostgreSQL, MySQL, SQL Server, SQLite, Oracle, Snowflake, BigQuery, MongoDB, and related execution abstractions.
- Connection management with encrypted connection strings, test connection endpoints, schema browsing endpoints, and basic connection UI.
- SQL-first report builder with connection selection, Monaco editor, schema browser, run preview, parameters, columns, visualizations, settings, and scheduling tab.
- Dataset-backed report builder path with dataset selection, semantic field picker, and generated SQL for selected dimensions/measures.
- First-class workspace model and UI for grouping reports and connections.
- First-class dataset model and UI with source metadata, inspect action, semantic fields, semantic measures, and dataset lifecycle endpoints.
- First-class dashboard asset model/API and initial dashboard management UI.
- Report viewer with parameters, manual/auto run flow, server-side pagination, export menu, auto-refresh selector, fullscreen visualization modal, copy-link-with-params behavior, and cache freshness indicators.
- Report catalog with search, categories, tags, favorites, ratings, grid/list modes, sorting controls, and pagination.
- Query playground with Monaco editor, schema browser, locally saved queries, and result preview.
- Core visualization renderers for table, Chart.js charts, KPI, gauge, radar, funnel, heatmap, treemap, and waterfall components.
- Upload and stream ingest surfaces exist, with backend ingest pipeline and sample Docker data.
- Embed package exists for embeddable report widgets.
- Security and operations work exists in code/docs: rate limiting, audit logging, correlation IDs, metrics, Docker/infra assets, and test projects.

### What Is Not Actually React/Python

The current repo is React plus .NET, not React plus Python. There are no Python application files, `pyproject.toml`, or `requirements.txt` in the repo. If "React/Python" is a hard platform decision, that is a strategic rewrite or service-extraction decision, not an incremental UI task.

## Critical Product Gaps vs Power BI

### 1. Semantic Model / Dataset Layer

Power BI centers on datasets, relationships, measures, calculated columns, hierarchies, and reusable fields. Kinetic now has the first dataset/semantic-model primitives, but the authoring and execution experience is still early.

Gaps:

- Dataset/model entity and detail view exist, including source metadata, fields, measures, lineage, linked reports, generated SQL, source sample preview, certification workflow, refresh queueing, and refresh history. Dataset permissions are still shallow.
- Relationship, measure, hierarchy, field metadata, default aggregation, hidden-field, and certification structures exist, with initial UI coverage for field, measure, relationship, and hierarchy editing.
- Report builder now has an initial semantic field picker and generated SQL, but visual field wells are not yet persisted per visual.
- Calculated columns and constrained expression validation are not implemented.
- Model lineage exists for connection -> dataset -> report and workspace -> dashboard; pinned visual lineage and dataflow lineage are still pending.

Impact: the platform can now start from curated datasets, but it is not yet a self-service semantic authoring product for business users.

### 2. Report Canvas and Dashboard Builder

Power BI reports are multi-page canvases with positioned visuals, filter panes, slicers, and interactions. Kinetic reports currently render visualizations mostly as tabs/single panels, and dashboards now exist as a saved asset, but the interactive dashboard/canvas builder is still missing.

Gaps:

- No drag-and-drop/resizable canvas.
- Dashboard entity/API, management UI, and canvas editor exist with persisted widget layout, report pins, KPI/text widgets, and move/resize controls. Drag/drop polish, dashboard viewer mode, and cross-filtering are still pending.
- No multi-page reports.
- No visual containers with position, size, z-order, title, actions, and style settings.
- No slicer/filter visuals.
- No cross-filtering or cross-highlighting between visuals.
- No drill-down/drill-through interactions.
- No bookmarks or saved views.

Impact: the app can display reports, but it does not yet feel like an interactive BI workspace.

### 3. Data Prep / Power Query Equivalent

Kinetic has upload and ingest paths, but not a durable transformation workflow.

Gaps:

- No dataflow entity.
- No transformation pipeline UI.
- No profiling/cleaning steps: rename, cast, filter, split, merge, append, dedupe.
- No previewable transformation history.
- No scheduled materialization of transformed datasets.
- No source-to-target lineage UI.

Impact: users need cleaned source tables or hand-written SQL before Kinetic becomes useful.

### 4. Refresh, Scheduling, and Operations

There is queue infrastructure, refresh job persistence, recurring refresh schedule persistence, a hosted due-schedule queueing loop, a hosted queued-job processor, and a dataset refresh history/schedule surface, but not a complete refresh operations experience.

Gaps:

- Recurring dataset refresh schedules now persist with cron/timezone metadata and can queue due jobs through both an API endpoint and a hosted background loop. Queued refresh jobs are now processed by a hosted worker for dataset source validation, report execution, and dashboard pinned-report validation. Full materialized dataset/dataflow refresh and alerting are still pending.
- Dataset refresh history now exists; report refresh history and a global operations view are pending.
- Failed refresh jobs now record failure status/message. User-facing failed-refresh alerts are still pending.
- No cache warming UI.
- No incremental refresh policy.
- No gateway/agent story for private networks.
- No dependency-aware refresh order.

Impact: production BI consumers cannot trust data freshness or understand refresh failures.

### 5. Sharing, Workspaces, and Governance

Kinetic has users/groups/permissions/visibility and now has a first-class workspace container with initial member roles. The remaining gap is deeper Power BI-style workspace operations: sharing, lifecycle, deployment, and governance workflows.

Gaps:

- Workspace entity and APIs exist for grouping dashboards/reports/datasets/connections, with initial viewer/contributor/member/admin membership. Deeper lifecycle workflows are still pending.
- No share dialog with people/groups, links, expiration, and permission levels.
- No endorsement/certification/promoted content workflow.
- No deployment pipeline concept for dev/test/prod content.
- No report version history or rollback.
- No approval workflow for public/featured reports.
- No tenant/org admin settings UI deep enough for enterprise governance.

Impact: permissions exist at a technical level, but content lifecycle and collaboration are not productized.

### 6. Identity, Profiles, SSO, Azure, and System Integrations

Enterprise BI requires identity and operational integrations to be first-class, not bolt-ons. Kinetic has local auth, user/group/admin surfaces, profile UI, JWT handling, some organization branding/settings foundations, and an initial system-integration account model. Local username/password login remains the baseline path and is not blocked by Azure, Entra ID, or any external identity provider. The remaining work is production-grade identity federation hardening and provider-specific external system integration.

Gaps:

- User profile preferences, notification settings, password update, refresh-session management, API token management, and connected-account records are now backed by API endpoints and UI. Provider OAuth handshakes are still pending.
- Microsoft Entra ID login now has authorization-start, callback, ID-token validation, local user upsert, connected-account recording, external group-claim mapping foundations, and global identity integration records can drive tenant/client/authority/secret-reference configuration. SCIM/user provisioning and production login policy controls are still pending.
- Azure DevOps integration records can now be stored, but work item links, release/deployment tracking, backlog/task generation from report issues, and dashboard/report lifecycle hooks are not implemented.
- Azure/platform integration records can now be stored, but Key Vault-backed secret resolution, storage accounts, tenant branding, private endpoints, managed identity, Log Analytics/App Insights, and Azure SQL/Synapse/Fabric-specific source workflows are not implemented.
- System-login/integration account records now exist for service principals and machine credentials, but credential rotation, scheduled refresh identity binding, provider validation, and machine-login audit views are not implemented.
- No enterprise login policy controls: MFA enforcement hints, allowed domains, session duration, token revocation, conditional-access documentation, or break-glass admin flow.

Impact: the product can be used locally, but it is not yet ready for enterprise identity, governed refresh, or Azure-centered operations.

### 7. Visual Analytics Depth

The codebase has many renderer components and config models, but the viewer path only handles a subset directly and many Power BI visual behaviors are missing.

Gaps:

- Viewer only directly maps Table, common Chart.js types, KPI, and Gauge in the inspected path.
- Advanced renderers exist but are not fully integrated through the viewer/config contract.
- No pivot/matrix implementation equivalent to Power BI Matrix.
- No conditional formatting UI.
- No visual-level filters.
- No tooltip pages/custom tooltips.
- No small multiples.
- No map visual integration despite backend model types.
- No visual marketplace/custom visual plugin system.

Impact: the visual type list is broader than the fully working end-to-end visual experience.

### 8. API/UI Contract Mismatches

These are immediate execution risks in the current app.

Initial observed mismatches:

- Frontend report form used `executionMode: "Auto" | "Manual"`, while backend report DTO used `autoRun: bool`. Phase 0 now supports both at the API boundary and returns both fields.
- Frontend viewer checked `report.executionMode`, while backend `MapReportFull` returned only `autoRun`. Phase 0 now returns `executionMode`.
- Catalog sent `orderBy`, `scope`, and `tag`, while the inspected report endpoint accepted only older filters. Phase 0 added these report catalog filters.
- Frontend report type expected `category`, `connection`, `isFavorite`, `averageRating`, and `ratingCount`, while the listed backend mapper returned mostly IDs/names. Phase 0 expanded report list/detail DTOs.
- Frontend created visualization objects with `config` nested under a generic object, while backend expected polymorphic `VisualizationConfig` subclasses. Phase 0 added builder-side payload mapping to backend discriminators.
- Query result shapes still vary between frontend expectations (`rowCount`, `cached`, `cachedAt`) and endpoint responses (`rowsReturned`, no cache metadata on report execution in the inspected endpoint).

Impact: the highest-risk report catalog/builder contract mismatches are now partially stabilized, but shared/generated DTOs and report execution result alignment are still needed before large BI-domain work.

### 9. UX/Product Polish

The app has improved beyond older UI gap notes, but still has product polish gaps.

Gaps:

- Mixed Bootstrap and Tailwind component styles produce inconsistent UI.
- Some components still use emoji icons instead of the app icon system.
- Branding assets referenced by layout (`/favicon.png`, `/logo-full.png`) should be verified against actual public assets.
- Mobile responsiveness exists in places but is not complete across dense builder/viewer workflows.
- Accessibility needs systematic testing: modal focus trap, keyboard paths, ARIA live updates, contrast, and screen reader behavior.
- Empty/loading states are present in some areas but not consistently across admin, upload, ingest, and builder flows.

## Build vs Rewrite Decision

### Option A: Continue Existing App

Best if:

- The goal is a private/enterprise BI/reporting product.
- .NET is acceptable for the backend.
- We want fastest path to a working Power BI-like MVP.
- Existing auth, adapters, query execution, exports, embed, infra, and audit work are valuable.

Pros:

- Preserves a large amount of working infrastructure.
- Lower risk than rebuilding connectors, auth, security, queueing, exports, and deployment.
- Lets us improve the product in vertical slices.

Cons:

- Requires cleanup of API/UI contracts.
- Requires adding new domain concepts to a system originally shaped around reports.
- May carry style and architectural inconsistencies unless we deliberately standardize.

### Option B: Full New React/Python App

Best if:

- Python is non-negotiable for the backend.
- We want to build around DuckDB/Polars/dbt/SQLGlot/semantic-layer tooling from day one.
- The current .NET stack is not maintainable by the target team.
- The product direction is closer to notebook/dataframe/data-app workflows than enterprise .NET reporting.

Pros:

- Clean domain model around datasets, semantic models, dashboards, and refresh from the start.
- Easier integration with Python analytics ecosystem.
- Chance to reset UI system and contracts.

Cons:

- Rebuilds solved work: auth, permissions, adapters, query execution, security, exports, embed, CI, infra.
- Longer time before there is a better product than the current app.
- Higher migration risk unless current features are explicitly deprecated.

### Recommendation

Proceed with Option A for one stabilization and product-foundation phase. Re-evaluate after Phase 1. If Phase 1 exposes pervasive breakage or if Python becomes a hard requirement, pivot to a new Python service or full app with lessons from this repo.

A likely middle path is best: keep React, keep the existing .NET API initially, and add Python selectively for data prep/semantic-model execution if it provides clear value.

## Target Product Shape

Kinetic should evolve from "SQL report builder" to "BI workspace."

Core nouns:

- Workspace: container for users, datasets, reports, dashboards, permissions, and lifecycle.
- Connection: source credentials and schema access.
- Dataset: curated tables/queries from one or more connections.
- Semantic model: relationships, measures, calculated fields, default aggregations, field metadata.
- Report: multi-page interactive canvas built on a dataset/model.
- Dashboard: pinned visuals/KPIs from reports, with layout and global filters.
- Dataflow: repeatable data prep/transformation pipeline.
- Refresh job: scheduled or manual materialization/cache update with history and alerts.

## Execution Plan

### Phase 0: Stabilize the Current App Contract

Goal: make the current report/catalog/viewer/builder flows reliable before expanding the domain.

Progress completed on 2026-06-30:

- Aligned the report create/list/detail DTO surface with frontend needs: `executionMode`, `autoRun`, `cacheMode`, `allowEmbed`, tags, visibility, category, connection, favorite state, rating stats, ownership, and metadata.
- Added report API support for catalog filters used by the UI: tags, tag, scope, visibility, order, sort direction, favorites, ratings, and tags lookup.
- Added report rating endpoint and tags endpoint.
- Updated the report builder save/load mapping so the React form serializes backend-compatible report payloads and visualization discriminators.
- Switched report preview from the removed detect-columns assumption to the query preview endpoint.
- Added HTTP JSON string-enum support so React payloads can send enum values as strings.
- Fixed JWT claim fallback across auth, report, query, and connection endpoints so authenticated frontend/API tests read both `sub` and mapped name-identifier claims.
- Hardened the integration test host: stable in-memory database per host, test config injection, no SQL Server provider conflict in Testing, no Redis health check when Redis is disabled, and no rate-limiter bleed-through in tests.
- Added integration coverage for connection create -> report create -> detail -> catalog filter -> rating -> tags.
- Added report-scoped execution and export endpoints used by the viewer: `POST /api/reports/{id}/execute` and `GET /api/reports/{id}/export/{format}`.
- Extended integration coverage through edit -> execute -> CSV export using a local SQLite report source.

Tasks:

- Add generated or shared API DTO types so frontend and backend stop drifting.
- Finish cache metadata alignment for report execution: `cached` and `cachedAt` are present in the report-scoped response, but true cache-hit detection is not yet wired through `QueryExecutionResult`.
- Extend export coverage beyond CSV to Excel and PDF.
- Add frontend E2E tests for catalog filters, builder save, viewer execute, and connection test.
- Replace JSON-list tag filtering with a relational tag table or provider-specific JSON query before large-scale production use.
- Add database-level validation that report creation references an accessible connection.

Exit criteria:

- One seeded report can be created, listed, edited, executed, exported to CSV, favorited, rated, and viewed from a clean local environment. Completed for create/list/detail/edit/execute/export/rate/tags in integration tests.
- Remaining exit work: Excel/PDF export coverage, frontend E2E, and shared DTO generation.
- Contract mismatch bugs are tracked or fixed.

### Phase 1: Decide and Implement the BI Domain Foundation

Goal: introduce Power BI-like nouns without disrupting existing reports.

Progress completed on 2026-06-30:

- Added a first-class `Workspace` domain model as the content container for BI assets.
- Added optional `WorkspaceId` links on reports and connections.
- Added workspace-aware report filtering through `workspaceId`.
- Added workspace metadata to report and connection DTOs.
- Added authenticated workspace API endpoints: list, detail, create, update, archive, and set default.
- Added workspace counts for reports and connections.
- Added integration coverage for workspace lifecycle plus grouping a connection and report inside a workspace.
- Added an EF design-time context factory.
- Resolved the organization `GroupPermissions` table-name conflict by explicitly mapping organization tables separately from identity tables.
- Generated the `AddWorkspaces` SQL Server EF migration and updated the model snapshot. The migration also captures pre-existing model drift from the stale initial snapshot, including organization/profile/embed/query-log schema additions and report execution-mode normalization.
- Added a React workspace section with list/search, create/edit, archive, set-default, report/connection counts, and quick links.
- Added workspace selection to connection and report forms, including URL preselection from workspace quick links.
- Added workspace filtering and workspace badges in the report catalog.
- Added workspace display to the connection list and backend connection DTO mapping.
- Added `Dataset` and semantic-model domain primitives: tables, fields, relationships, measures, and hierarchies.
- Added dataset EF mapping using JSON-backed model definitions plus the clean `AddDatasets` SQL Server migration.
- Added authenticated dataset API endpoints: list/filter, detail, create, update, archive, and inspect source table fields.
- Added integration coverage for dataset lifecycle in a workspace with connection association and semantic metadata.
- Added a React dataset section with workspace filtering, create/edit/archive flow, connection binding, source query/table metadata, field/measure counts, and source inspection action.
- Added dataset semantic authoring basics in the dataset form: fields can be edited for display name/kind/default aggregation/hidden state, and semantic measures can be added, edited, and removed.
- Linked reports to datasets with optional `DatasetId` while preserving direct SQL reports.
- Generated the clean `AddReportDatasets` SQL Server migration with nullable report dataset FK and index.
- Added dataset metadata to report list/detail DTOs and report catalog cards/list rows.
- Added dataset filtering in the report catalog API through `datasetId`.
- Added semantic SQL generation endpoint: `POST /api/datasets/{id}/query` accepts selected dimensions, measure fields, and semantic measures.
- Added report builder dataset selection and a semantic field picker that generates SQL from selected dataset fields/measures.
- Added integration coverage for dataset-backed reports and semantic query generation.
- Added first-class `Dashboard` domain model/API with widgets, filters, workspace ownership, visibility, archive flow, and clean `AddDashboards` SQL Server migration.
- Added React dashboard management page with workspace filter, create/edit/archive, layout preview, and sidebar route.
- Expanded workspace summaries to count dashboards, reports, datasets, and connections.
- Added integration coverage for dashboard lifecycle.
- Added dashboard canvas editor route with persisted grid coordinates, report visual pinning, KPI/text widgets, and move/resize controls.

Tasks:

- Add `Workspace` domain model and routes. Initial minimal workspace container is complete.
- Add `Dataset` domain model with source connection/query/table references. Initial model is complete.
- Add `SemanticModel` metadata: tables, fields, relationships, measures, calculated fields. Initial metadata structure, field/measure editing, and basic generated SQL are complete; relationship UI, calculated columns, and expression validation are still pending.
- Add lineage relationships: connection -> dataset -> semantic model -> report/dashboard. Connection -> dataset -> report and workspace -> dashboard are complete; pinned visual lineage is pending.
- Add migration path: existing report becomes a report with an implicit SQL dataset.
- Add workspace-aware permissions and basic workspace UI. Basic workspace UI, initial member/role management, and dataset/report/dashboard/connection/integration/refresh workspace role enforcement are complete.
- Add dataset detail page with schema, fields, sample data, and refresh status. Dataset detail now covers source metadata, fields, measures, lineage, linked reports, generated SQL, sample row preview, certification controls, queue refresh, and refresh history. Relationship and hierarchy authoring are available in the dataset editor.
- Review the broad `AddWorkspaces` migration against a real SQL Server database before production rollout because it includes accumulated snapshot drift, not only workspace tables.

Exit criteria:

- Users can create a workspace, create a dataset from an existing connection/query, and build a report against that dataset. Complete for the initial create/edit/generate-SQL flow.
- Existing SQL reports still work. Complete in backend build/test coverage.
- Remaining exit work: implicit SQL dataset migration path and deeper cross-workspace share workflows.

### Phase 2: Build the Dashboard and Canvas Experience

Goal: make the product feel like BI, not just report tabs.

Tasks:

- Add `Dashboard` entity and API. Initial dashboard asset CRUD is complete.
- Use a grid layout library for draggable/resizable dashboard widgets. Initial persisted grid editor exists with controls; drag/drop library polish is pending.
- Add report visual pinning to dashboards. Initial report pinning is complete.
- Add dashboard-level filters and parameter bindings.
- Convert report viewer from tab-only visual selection to optional multi-visual canvas layout.
- Add visual container actions: fullscreen, export, copy, refresh, inspect data.
- Add cross-filtering event model for visuals on the same canvas.

Exit criteria:

- Users can compose multiple visuals into a dashboard, resize/rearrange them, save layout, and filter the dashboard.

### Phase 3: Semantic Authoring and Self-Service Visual Builder

Goal: reduce dependence on hand-written SQL.

Tasks:

- Build dataset field list and drag/drop field wells. Initial checkbox field picker exists in the report builder; persisted visual field wells and drag/drop are pending.
- Add aggregations: sum, avg, min, max, count, distinct count. Initial generated SQL supports these aggregations for dataset measure fields.
- Add calculated measures with a constrained expression syntax. Raw semantic measure expressions exist; validation/sandboxing is pending.
- Add relationship editor between dataset tables.
- Add visual-level filter pane.
- Add conditional formatting for tables, KPIs, and charts.
- Add matrix/pivot visual.
- Add drill-down/drill-through configuration.

Exit criteria:

- A non-SQL author can build a basic report from a curated dataset.

### Phase 4: Refresh, Dataflows, and Operational Trust

Goal: make data freshness inspectable and reliable.

Progress completed on 2026-06-30:

- Added `RefreshJob` domain model for dataset/report/dashboard refresh history.
- Added authenticated refresh job endpoints: list/filter, queue, and complete.
- Added dataset refresh completion behavior that updates `LastRefreshedAt`.
- Generated the `AddRefreshJobsAndDatasetCertification` SQL Server migration for refresh jobs and dataset certification metadata.
- Added integration coverage for queue/list/complete dataset refresh.
- Added dataset detail refresh controls and refresh history table.
- Added dataset certification metadata and dedicated certify/revoke endpoint with integration coverage.
- Added dataset detail certification controls and removed the raw certification toggle from the dataset edit form.
- Added dataset workspace role enforcement: workspace viewers can read/query datasets, contributors can edit dataset metadata, and admins/owners can certify.
- Added report workspace role enforcement: workspace viewers can list/view/execute/export/rate reports, and contributors/owners can mutate or schedule reports.
- Added dashboard workspace role enforcement: workspace viewers can list/view dashboards, and contributors/owners can create, update, or archive dashboards.
- Added connection workspace role enforcement: workspace viewers can list/view connections, contributors/owners can create, update, test, or archive connections, and connection listing now defaults missing paging parameters.
- Added integration workspace role enforcement: workspace viewers can list/view integrations, and contributors/owners can create, update, validate, or archive integrations.
- Added refresh job workspace role enforcement: workspace viewers can inspect refresh history, and contributors/owners can queue or complete refresh jobs for datasets, reports, and dashboards.
- Fixed SQL Server temp-cache startup schema SQL by escaping the `[RowCount]` metadata column.
- Added `RefreshSchedule` persistence, SQL Server migration, and authenticated schedule endpoints for list/create/update/delete plus `run-due` queueing.
- Added dataset detail UI for recurring refresh schedules with create, enable/disable, delete, and next-run display.
- Added integration coverage for invalid cron rejection, schedule creation, listing, disabling, and deletion.
- Added `RefreshScheduleHostedService` and `RefreshScheduleRunner` to evaluate due schedules on a configurable interval and queue scheduled `RefreshJob` records without requiring a manual API call.
- Added runner coverage proving due schedules queue one scheduled job, advance `NextRunAt`, and avoid duplicate queued/running scheduled jobs for the same target.
- Added `RefreshJobProcessor` and hosted worker to process queued refresh jobs, mark running/succeeded/failed status, validate dataset source queries/tables, execute report refresh checks, validate dashboard pinned reports, and stamp dataset `LastRefreshedAt` on success.
- Expanded refresh integration coverage through source-backed scheduled refresh queueing and successful job processing.

Tasks:

- Persist recurring refresh schedules. Complete for dataset schedules, API-driven due-job queueing, and hosted due-schedule queueing.
- Add refresh job history and status UI. Dataset-level history/schedules are complete; report/global operations history is pending.
- Add actual refresh execution/completion workers for queued dataset/report/dashboard refresh jobs. Initial hosted processor is complete for validation/execution checks; materialized refresh and provider-specific execution are pending.
- Add failure notifications and admin alerts.
- Add cache warming and invalidation controls.
- Add incremental refresh policy where feasible.
- Add dataflow model and transformation-step UI.
- Evaluate Python service for data prep execution with DuckDB/Polars if that becomes useful.

Exit criteria:

- Users can schedule refreshes, inspect history, diagnose failures, and trust freshness indicators.

### Phase 5: Governance, Collaboration, and Enterprise Readiness

Goal: support team-scale BI operations.

Progress completed on 2026-06-30:

- Added provider-neutral `SystemIntegration` domain model for Microsoft Entra ID, Azure DevOps, Azure, OIDC, SAML, service-principal/system-login, and custom integrations.
- Added integration metadata for provider, category, auth mode, workspace, tenant/client/authority, secret reference, settings JSON, validation status, enabled state, visibility, and ownership.
- Added authenticated integration endpoints: list/filter, detail, create, update, disable/archive, and validation-status stub.
- Generated the clean `AddSystemIntegrations` SQL Server migration.
- Added integration coverage for Entra-style SSO configuration, Azure DevOps configuration, validation status, archive, and disabled-list behavior.
- Added admin integration management UI with templates for Microsoft Entra ID, Azure DevOps, Azure platform, system-login/service-principal, generic OIDC, and SAML configuration.
- Added frontend types and admin navigation for enterprise integrations.
- Added workspace member domain/API/UI with viewer, contributor, member, and admin roles.
- Added integration coverage for workspace member add/list/update/remove and member workspace access.
- Added self-service profile endpoints and UI backing for profile details, preferences, notification settings, password changes, group membership display, refresh-session listing/revocation, and hashed API token create/list/revoke.
- Added `UserApiToken` domain model and SQL Server migration so API token secrets are stored as hashes and plaintext tokens are only returned once at creation.
- Added self-service connected-account records for Microsoft Entra ID, Azure DevOps, Azure, OIDC, SAML, service-principal, and custom providers with list/link/verify/revoke UI and API coverage.
- Added Microsoft Entra ID/OIDC login plumbing: `/api/auth/entra/config`, authorization redirect, callback token exchange, signed ID-token validation, Kinetic user upsert, connected-account stamping, Entra group claim mapping by external group ID, and a React `/auth/callback` route.
- Connected Entra login configuration to global identity integration records, including tenant/client/authority resolution and `env:`, `config:`, or `literal:` secret-reference lookup.
- Replaced the integration validation placeholder with provider-aware checks for Entra/OIDC, Azure DevOps, Azure platform, service-principal/system-login, and SAML records. OIDC discovery probing is available behind `settings.validateDiscovery`.
- Verified local auth remains independent of Entra/Azure: `/api/auth/login` responds locally and `/api/auth/entra/config` reports disabled when no external identity configuration is present.

Tasks:

- Add share dialog for users/groups/workspaces.
- Add workspace roles: viewer, contributor, member, admin. Initial workspace membership CRUD plus dataset/report/dashboard/connection/integration/refresh role enforcement are complete.
- Expand user profiles with preferences, notification settings, active sessions, API tokens, and connected accounts. Initial self-service profile, preferences, password, groups, session management, API token management, and connected-account records are complete; provider OAuth handshakes are pending.
- Complete Microsoft Entra ID/SSO production hardening: encrypted/Key Vault secret resolution, SCIM/user provisioning, role-claim mapping, logout/session federation, and conditional-access/MFA policy guidance. Initial login/callback, admin integration config source, and group-claim mapping are complete.
- Add Azure DevOps integration for work item links, deployment notes, report/dashboard issue capture, and lifecycle traceability. Integration records can be stored; provider workflow is pending.
- Add Azure platform integration settings for Key Vault, managed identity, storage, App Insights/Log Analytics, and Azure SQL/Synapse/Fabric connection shortcuts. Integration records can be stored; provider workflow is pending.
- Add system integration accounts for scheduled refresh, service-principal credentials, rotation metadata, and machine-login audit events. Initial account records are complete; binding/rotation/audit views are pending.
- Add login/security policy controls for allowed domains, session duration, token revocation, MFA/conditional-access guidance, and break-glass admin.
- Add version history and rollback for reports/datasets.
- Add content endorsement: promoted/certified.
- Add deployment lifecycle: dev/test/prod or draft/published.
- Add usage analytics: popular reports, stale reports, failed reports, query cost.
- Add admin controls for branding, audit review, retention, quotas, and tenant settings.

Exit criteria:

- A team can govern content lifecycle and access without direct database/admin intervention.

## Immediate Next Work

1. Add a global refresh operations page and failure alerting so queued/succeeded/failed refresh jobs are easy to diagnose.
2. Build dashboard viewer mode and cross-filtering on top of the new dashboard canvas editor.
3. Persist report/visual field wells instead of treating generated dataset SQL as the only report artifact.
4. Expand identity foundations without blocking local login: encrypted/Key Vault secret resolution, provider OAuth handshakes beyond Entra, SCIM/user provisioning, role claim mapping, and system integration account binding.
5. Add Azure DevOps integration planning/work item links for BI content lifecycle.
6. Add generated/shared API DTO types so React and .NET contracts stop drifting.
7. Add frontend E2E tests for catalog filters, builder save, viewer execute/export, workspace flows, dataset flows, dashboards, generated dataset query flow, profile/security, and refresh schedules.
8. Review and apply the generated SQL Server migrations against a real database backup before production use.
9. Decide whether Python is a hard platform requirement or only useful later for data prep/semantic execution.

## Open Questions

- Is Python a mandatory backend requirement, or was "React/Python" shorthand for a modern open BI stack?
- Is the target user a SQL-capable analyst, a non-technical business user, or both?
- Do we need Power BI compatibility/import, or only a Power BI-like authoring and consumption experience?
- What source systems matter first: SQL databases, files, cloud warehouses, APIs, or streaming ingest?
- Is embedded analytics a primary product requirement or a secondary capability?
- Should this prioritize internal self-hosted deployment, SaaS multi-tenancy, or both?
- Which identity provider is first-class at launch: Microsoft Entra ID only, or Entra plus generic OIDC/SAML?
- What Azure DevOps workflows matter first: work item linking, release notes, deployment gates, report issue capture, or backlog generation?
- Which system-login identities are required first: service principals for refresh, managed identity, connector credentials, or admin automation tokens?
