# Kinetic Load Tests

Uses [k6](https://k6.io) for load testing.

## Prerequisites

```bash
# Install k6
brew install k6          # macOS
winget install k6        # Windows
sudo apt-get install k6  # Ubuntu/Debian
```

## Run

```bash
# Basic run against local dev server
k6 run query-load-test.js

# Against staging with auth
BASE_URL=https://staging.example.com \
TEST_EMAIL=loadtest@example.com \
TEST_PASSWORD=LoadTest1! \
k6 run query-load-test.js

# With output to InfluxDB for dashboarding
k6 run --out influxdb=http://localhost:8086/k6 query-load-test.js
```

## Thresholds

| Metric | Threshold |
|--------|-----------|
| p95 response time | < 3s |
| Error rate | < 1% |

## Stages

| Stage | Duration | Target VUs |
|-------|----------|-----------|
| Ramp up | 30s | 10 |
| Sustained load | 2m | 50 |
| Peak | 30s | 100 |
| Ramp down | 30s | 0 |
