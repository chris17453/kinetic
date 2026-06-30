#!/bin/bash
# Wait for SQL Server to start up
echo "Waiting for SQL Server to start..."
sleep 20

# Keep retrying until SQL Server is ready
for i in {1..30}; do
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Sample@Dev123!" -C -Q "SELECT 1" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "SQL Server is ready. Running init script..."
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Sample@Dev123!" -C -i /docker-init/seed.sql
    echo "Sample database initialized."
    exit 0
  fi
  echo "Not ready yet... retrying in 2s ($i/30)"
  sleep 2
done

echo "ERROR: SQL Server did not become ready in time."
exit 1
