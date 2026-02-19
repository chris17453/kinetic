# API Reference

Base URL: `https://your-kinetic-instance/api`

## Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "abc123...",
  "expiresAt": "2024-01-15T12:00:00Z",
  "user": {
    "id": "guid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "abc123..."
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer {token}
```

### Entra ID Login
```http
GET /auth/entra/login
```
Redirects to Microsoft login page.

### Entra ID Callback
```http
GET /auth/entra/callback?code={code}&state={state}
```

---

## Users

### List Users
```http
GET /users
Authorization: Bearer {token}
```

Query parameters:
- `page` (int): Page number (default: 1)
- `pageSize` (int): Items per page (default: 20, max: 100)
- `search` (string): Search by name or email
- `groupId` (guid): Filter by group membership

### Get User
```http
GET /users/{id}
Authorization: Bearer {token}
```

### Update User
```http
PUT /users/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Name",
  "departmentId": "guid"
}
```

### Delete User
```http
DELETE /users/{id}
Authorization: Bearer {token}
```

---

## Groups

### List Groups
```http
GET /groups
Authorization: Bearer {token}
```

### Create Group
```http
POST /groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Sales Team",
  "description": "Sales department group"
}
```

### Get Group
```http
GET /groups/{id}
Authorization: Bearer {token}
```

### Update Group
```http
PUT /groups/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### Delete Group
```http
DELETE /groups/{id}
Authorization: Bearer {token}
```

### Add Member to Group
```http
POST /groups/{id}/members
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "guid",
  "role": "member"
}
```

### Remove Member from Group
```http
DELETE /groups/{id}/members/{userId}
Authorization: Bearer {token}
```

### Get Group Permissions
```http
GET /groups/{id}/permissions
Authorization: Bearer {token}
```

### Update Group Permissions
```http
PUT /groups/{id}/permissions
Authorization: Bearer {token}
Content-Type: application/json

{
  "permissions": ["reports:create", "reports:view", "connections:view"]
}
```

---

## Connections

### List Connections
```http
GET /connections
Authorization: Bearer {token}
```

Query parameters:
- `type` (string): Filter by connection type (sqlserver, postgresql, mysql, etc.)

### Create Connection
```http
POST /connections
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production Database",
  "type": "sqlserver",
  "host": "db.example.com",
  "port": 1433,
  "database": "ProductionDB",
  "username": "readonly",
  "password": "secret",
  "options": {
    "trustServerCertificate": true
  }
}
```

### Get Connection
```http
GET /connections/{id}
Authorization: Bearer {token}
```

### Update Connection
```http
PUT /connections/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Name",
  "password": "new-password"
}
```

### Delete Connection
```http
DELETE /connections/{id}
Authorization: Bearer {token}
```

### Test Connection
```http
POST /connections/{id}/test
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "serverVersion": "Microsoft SQL Server 2019"
}
```

### Get Connection Schema
```http
GET /connections/{id}/schema
Authorization: Bearer {token}
```

**Response:**
```json
{
  "tables": [
    {
      "schema": "dbo",
      "name": "Users",
      "columns": [
        { "name": "Id", "type": "int", "nullable": false },
        { "name": "Name", "type": "nvarchar(100)", "nullable": false }
      ]
    }
  ]
}
```

---

## Reports

### List Reports
```http
GET /reports
Authorization: Bearer {token}
```

Query parameters:
- `page`, `pageSize`: Pagination
- `search`: Search by name
- `categoryId`: Filter by category
- `ownerId`: Filter by owner

### Create Report
```http
POST /reports
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Monthly Sales Report",
  "description": "Sales by region and product",
  "connectionId": "guid",
  "query": "SELECT region, product, SUM(amount) as total FROM sales WHERE date >= @startDate AND date <= @endDate GROUP BY region, product",
  "parameters": [
    {
      "name": "startDate",
      "type": "date",
      "label": "Start Date",
      "required": true,
      "default": "{{firstDayOfMonth}}"
    },
    {
      "name": "endDate",
      "type": "date",
      "label": "End Date",
      "required": true,
      "default": "{{today}}"
    }
  ],
  "columns": [
    { "name": "region", "label": "Region", "visible": true },
    { "name": "product", "label": "Product", "visible": true },
    { "name": "total", "label": "Total Sales", "format": "currency" }
  ],
  "visualizations": [
    {
      "type": "table",
      "config": { "pageSize": 25, "sortable": true }
    },
    {
      "type": "bar",
      "config": { "xAxis": "region", "yAxis": "total", "groupBy": "product" }
    }
  ],
  "settings": {
    "autoRun": false,
    "cacheEnabled": true,
    "cacheTtlMinutes": 60
  }
}
```

### Get Report
```http
GET /reports/{id}
Authorization: Bearer {token}
```

### Update Report
```http
PUT /reports/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Report Name",
  ...
}
```

### Delete Report
```http
DELETE /reports/{id}
Authorization: Bearer {token}
```

### Execute Report
```http
POST /reports/{id}/execute
Authorization: Bearer {token}
Content-Type: application/json

{
  "parameters": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  },
  "page": 1,
  "pageSize": 50
}
```

**Response:**
```json
{
  "executionId": "guid",
  "status": "completed",
  "data": [
    { "region": "North", "product": "Widget A", "total": 15000.00 },
    ...
  ],
  "totalRows": 1250,
  "page": 1,
  "pageSize": 50,
  "executionTimeMs": 245
}
```

### Get Execution Results
```http
GET /reports/{id}/results/{executionId}?page=2&pageSize=50
Authorization: Bearer {token}
```

---

## Catalog

### Browse Catalog
```http
GET /catalog
Authorization: Bearer {token}
```

Query parameters:
- `scope` (string): "all", "my", "group", "favorites"
- `categoryId` (guid): Filter by category
- `tags` (string[]): Filter by tags
- `search` (string): Search term

### Get Categories
```http
GET /catalog/categories
Authorization: Bearer {token}
```

### Add to Favorites
```http
POST /catalog/favorites/{reportId}
Authorization: Bearer {token}
```

### Remove from Favorites
```http
DELETE /catalog/favorites/{reportId}
Authorization: Bearer {token}
```

### Rate Report
```http
POST /catalog/ratings/{reportId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "rating": 5
}
```

---

## Export

### Export to Excel
```http
POST /export/excel
Authorization: Bearer {token}
Content-Type: application/json

{
  "reportId": "guid",
  "executionId": "guid",
  "options": {
    "includeHeaders": true,
    "sheetName": "Report Data"
  }
}
```

**Response:** Binary file download

### Export to PDF
```http
POST /export/pdf
Authorization: Bearer {token}
Content-Type: application/json

{
  "reportId": "guid",
  "executionId": "guid",
  "options": {
    "orientation": "landscape",
    "pageSize": "A4",
    "includeCharts": true
  }
}
```

### Export to CSV
```http
POST /export/csv
Authorization: Bearer {token}
Content-Type: application/json

{
  "reportId": "guid",
  "executionId": "guid"
}
```

---

## Embed

### Generate Embed Token
```http
POST /embed/tokens
Authorization: Bearer {token}
Content-Type: application/json

{
  "reportId": "guid",
  "expiresInMinutes": 60,
  "allowedDomains": ["example.com"],
  "options": {
    "showParameters": true,
    "showExport": false
  }
}
```

**Response:**
```json
{
  "token": "embed_xyz...",
  "expiresAt": "2024-01-15T13:00:00Z"
}
```

### Get Embedded Report
```http
GET /embed/{token}
```

Returns report definition for rendering.

---

## AI

### Generate Query from Natural Language
```http
POST /ai/generate-query
Authorization: Bearer {token}
Content-Type: application/json

{
  "connectionId": "guid",
  "prompt": "Show me total sales by region for last month"
}
```

**Response:**
```json
{
  "query": "SELECT region, SUM(amount) as total_sales FROM sales WHERE date >= DATEADD(month, -1, GETDATE()) GROUP BY region",
  "explanation": "This query calculates the sum of sales amounts grouped by region for the last 30 days."
}
```

### Get Report Insights
```http
POST /ai/insights
Authorization: Bearer {token}
Content-Type: application/json

{
  "reportId": "guid",
  "executionId": "guid"
}
```

**Response:**
```json
{
  "summary": "Sales increased 15% compared to previous period...",
  "insights": [
    "North region shows strongest growth at 23%",
    "Widget B is the top performing product"
  ],
  "recommendations": [
    "Consider increasing inventory for Widget B in North region"
  ]
}
```

### Suggest Visualization
```http
POST /ai/suggest-visualization
Authorization: Bearer {token}
Content-Type: application/json

{
  "columns": [
    { "name": "date", "type": "datetime" },
    { "name": "region", "type": "string" },
    { "name": "amount", "type": "decimal" }
  ],
  "rowCount": 500
}
```

---

## Organizations

### Get Organization
```http
GET /organizations/{id}
Authorization: Bearer {token}
```

### Update Organization Branding
```http
PUT /organizations/{id}/branding
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Acme Corp",
  "logoUrl": "https://...",
  "primaryColor": "#3B82F6",
  "secondaryColor": "#1E40AF",
  "fontFamily": "Inter"
}
```

---

## Admin

### Get Audit Logs
```http
GET /admin/audit
Authorization: Bearer {token}
```

Query parameters:
- `startDate`, `endDate`: Date range
- `userId`: Filter by user
- `action`: Filter by action type
- `resource`: Filter by resource type

### Get System Settings
```http
GET /admin/settings
Authorization: Bearer {token}
```

### Update System Settings
```http
PUT /admin/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "allowRegistration": true,
  "defaultRoleId": "guid",
  "maxConcurrentQueries": 10
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      { "field": "email", "message": "Email is required" }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| CONNECTION_ERROR | 500 | Database connection failed |
| QUERY_ERROR | 500 | Query execution failed |
| INTERNAL_ERROR | 500 | Unexpected server error |
