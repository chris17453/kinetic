SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:

.DEFAULT_GOAL := help

API_URL ?= http://localhost:5000
UI_PORT ?= 5173
UI_URL ?= http://localhost:$(UI_PORT)
DB_CONNECTION ?= Server=localhost,1433;Database=Kinetic;User Id=sa;Password=Kinetic@Dev123!;TrustServerCertificate=True
REDIS_CONNECTION ?= localhost:6379
ENCRYPTION_KEY ?= dev-encryption-key-32-chars-ok!!
JWT_SECRET ?= dev-jwt-secret-at-least-32-characters-long
JWT_ISSUER ?= kinetic
JWT_AUDIENCE ?= kinetic-users
DEV_USER_EMAIL ?= localdev@example.com
DEV_USER_PASSWORD ?= LocalDev123!
DEV_USER_NAME ?= Local Dev

API_PROJECT := src/Kinetic.Api/Kinetic.Api.csproj
DATA_PROJECT := src/Kinetic.Data
UI_DIR := ui
SOLUTION := Kinetic.slnx

API_ENV := \
	ASPNETCORE_URLS="$(API_URL)" \
	ASPNETCORE_ENVIRONMENT=Development \
	ConnectionStrings__DefaultConnection="$(DB_CONNECTION)" \
	Cors__AllowedOrigins__0="$(UI_URL)" \
	Redis__ConnectionString="$(REDIS_CONNECTION)" \
	Encryption__Key="$(ENCRYPTION_KEY)" \
	Jwt__Secret="$(JWT_SECRET)" \
	Jwt__Issuer="$(JWT_ISSUER)" \
	Jwt__Audience="$(JWT_AUDIENCE)"

.PHONY: help dev launch dbs infra infra-tools sample-dbs observability wait-dbs wait-infra migrate api ui dev-user install build test test-contract test-e2e test-all stop down status

help:
	@printf "Kinetic local development\n\n"
	printf "Usage:\n"
	printf "  make dev            Start Docker databases, run migrations, then launch local API + UI\n"
	printf "  make dbs            Start Docker SQL Server and Redis only\n"
	printf "  make migrate        Apply EF Core migrations to the local database\n"
	printf "  make api            Run the .NET API on %s\n" "$(API_URL)"
	printf "  make ui             Run the Vite UI on %s\n" "$(UI_URL)"
	printf "  make dev-user       Create/check the local dev login\n"
	printf "  make build          Build backend and frontend\n"
	printf "  make test           Run backend integration tests and frontend tests\n"
	printf "  make test-contract  Check generated frontend API DTOs against OpenAPI\n"
	printf "  make test-e2e       Run Playwright smoke tests against local API + UI\n"
	printf "  make test-all       Run test, contract, and E2E checks\n"
	printf "  make stop           Stop Docker services\n"
	printf "  make down           Stop Docker services and remove containers\n\n"
	printf "Optional services:\n"
	printf "  make infra-tools    Start Redis Commander\n"
	printf "  make sample-dbs     Start PostgreSQL/MySQL sample databases\n"
	printf "  make observability  Start Seq\n"

dev: launch

launch: dbs wait-dbs migrate
	@printf "Launching Kinetic API at %s and UI at %s\n" "$(API_URL)" "$(UI_URL)"
	trap 'jobs -pr | xargs -r kill' INT TERM EXIT
	$(API_ENV) dotnet run --project "$(API_PROJECT)" --no-launch-profile &
	cd "$(UI_DIR)"
	npm run dev -- --host 0.0.0.0 --port "$(UI_PORT)" --strictPort &
	wait

dbs:
	docker compose up -d mssql redis

infra:
	docker compose up -d mssql redis

infra-tools:
	docker compose --profile dev-tools up -d redis-commander

sample-dbs:
	docker compose --profile sample-dbs up -d postgres mysql

observability:
	docker compose --profile observability up -d seq

wait-dbs:
	@printf "Waiting for SQL Server and Redis to become healthy"
	for service in kinetic-mssql kinetic-redis; do
		for attempt in {1..60}; do
			status="$$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$$service" 2>/dev/null || true)"
			if [[ "$$status" == "healthy" || "$$status" == "running" ]]; then
				break
			fi
			if [[ "$$attempt" == "60" ]]; then
				printf "\n%s did not become healthy; last status: %s\n" "$$service" "$$status"
				exit 1
			fi
			printf "."
			sleep 2
		done
	done
	printf "\nDocker databases are ready\n"

wait-infra: wait-dbs

migrate:
	$(API_ENV) dotnet ef database update --project "$(DATA_PROJECT)" --startup-project "$(API_PROJECT)" --no-build

api:
	$(API_ENV) dotnet run --project "$(API_PROJECT)" --no-launch-profile

ui:
	cd "$(UI_DIR)"
	npm run dev -- --host 0.0.0.0 --port "$(UI_PORT)" --strictPort

dev-user:
	@printf "Creating local dev user %s\n" "$(DEV_USER_EMAIL)"
	response="$$(curl -sS -w '\n%{http_code}' \
		-H 'Content-Type: application/json' \
		-d "$$(printf '{"email":"%s","password":"%s","displayName":"%s"}' "$(DEV_USER_EMAIL)" "$(DEV_USER_PASSWORD)" "$(DEV_USER_NAME)")" \
		"$(API_URL)/api/auth/register")"
	body="$$(printf '%s\n' "$$response" | sed '$$d')"
	status="$$(printf '%s\n' "$$response" | tail -n 1)"
	if [[ "$$status" == "200" ]]; then
		printf "Dev user ready: %s / %s\n" "$(DEV_USER_EMAIL)" "$(DEV_USER_PASSWORD)"
	elif printf '%s' "$$body" | grep -q "Email already registered"; then
		printf "Dev user already exists. Try: %s / %s\n" "$(DEV_USER_EMAIL)" "$(DEV_USER_PASSWORD)"
	else
		printf "Could not create dev user. HTTP %s\n%s\n" "$$status" "$$body"
		exit 1
	fi

install:
	cd "$(UI_DIR)"
	npm install

build:
	dotnet build "$(SOLUTION)" --no-restore
	cd "$(UI_DIR)"
	npm run build

test:
	dotnet test tests/Kinetic.Api.IntegrationTests/Kinetic.Api.IntegrationTests.csproj --no-restore --logger "console;verbosity=minimal"
	cd "$(UI_DIR)"
	npm run test:run

test-contract: dbs wait-dbs migrate
	api_pid=""
	if ! curl -fsS "$(API_URL)/health" >/dev/null 2>&1; then
		$(API_ENV) dotnet run --project "$(API_PROJECT)" --no-launch-profile >/tmp/kinetic-api-contract.log 2>&1 &
		api_pid="$$!"
		trap '[[ -n "$$api_pid" ]] && kill "$$api_pid" 2>/dev/null || true' EXIT
		for attempt in {1..60}; do
			if curl -fsS "$(API_URL)/health" >/dev/null 2>&1; then
				break
			fi
			if [[ "$$attempt" == "60" ]]; then
				cat /tmp/kinetic-api-contract.log
				exit 1
			fi
			sleep 1
		done
	fi
	cd "$(UI_DIR)"
	KINETIC_OPENAPI_URL="$(API_URL)/openapi/v1.json" npm run api:types:check

test-e2e:
	cd tests/Kinetic.E2E
	BASE_URL="$(UI_URL)" API_URL="$(API_URL)" npm test -- --project=chromium

test-all: test test-contract test-e2e

stop:
	docker compose stop

down:
	docker compose down

status:
	ss -ltnp | awk '/:5000|:5173|:1433|:6379/ {print}'
