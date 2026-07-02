# Kinetic Agent Instructions

## Operating Loop

For implementation, debugging, review, and cleanup tasks, work autonomously until the requested outcome is complete or genuinely blocked.

Default loop:

1. Inspect the relevant code, tests, and docs.
2. Make a short plan for non-trivial work.
3. Use cheaper read-only research first when the task needs broad exploration.
4. Implement the smallest coherent change.
5. Run focused verification.
6. Fix failures and rerun verification.
7. Stop only when checks pass, the task is complete, or a real blocker is found.

Do not stop after proposing a plan unless the user explicitly asks for planning only.

## Cheap Research

For broad codebase exploration, dependency/docs lookup, log triage, or summarization, prefer spawning the `research-mini` subagent when available.

Use the main agent for final decisions, file edits, and integration work. Keep research agents read-only unless the user explicitly asks for parallel implementation.

## Verification

Prefer focused checks first, then broader checks when risk justifies it.

Backend:

- Build: `dotnet build Kinetic.slnx --no-restore`
- Backend tests: `dotnet test tests/Kinetic.Api.IntegrationTests/Kinetic.Api.IntegrationTests.csproj --no-restore --logger "console;verbosity=minimal"`

Frontend:

- Install dependencies in `ui/` with `npm install` if needed.
- Lint: `cd ui && npm run lint`
- Test: `cd ui && npm run test:run`
- Build: `cd ui && npm run build`

Whole project:

- Build: `make build`
- Standard tests: `make test`
- Contract check: `make test-contract`
- MCP smoke test: `make test-mcp`
- Full suite: `make test-all`

Use `make test-all` when touching cross-cutting API, UI, MCP, auth, setup, or generated API contract behavior.

## Repo Notes

- Use `Makefile` targets when possible.
- Start infrastructure with `make dbs` before checks requiring SQL Server or Redis.
- Use `make wait-dbs` after starting Docker-backed services.
- Avoid unrelated refactors.
- Do not commit generated local config such as `src/Kinetic.Api/kinetic.config.json`.
- Do not run destructive Docker volume cleanup unless the user explicitly asks.

## Review Guidelines

- Prioritize correctness, security, data access boundaries, behavior regressions, and missing test coverage.
- Treat auth, tenant/user permissions, SQL execution paths, report execution, token handling, and MCP data access as high-risk areas.
- For UI work, verify loading, empty, error, and narrow viewport states when the changed surface is user-facing.
