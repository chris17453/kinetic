# Admin Guide

This guide covers administrative tasks for managing Kinetic.

## Organization Setup

### Initial Configuration
After installation, complete these steps:

1. **Create Organization** - Set org name and branding
2. **Configure Auth** - Local users and/or Entra ID
3. **Create Groups** - Define permission groups
4. **Add Users** - Import or create users
5. **Set Up Connections** - Add database connections

### Branding
Navigate to Admin → Organization → Branding

Configure:
- **Organization Name**: Displayed in header
- **Logo**: Upload logo image (recommended: 200x50px PNG)
- **Login Background**: Custom background for login page
- **Primary Color**: Main brand color
- **Secondary Color**: Accent color
- **Font Family**: Typography choice

## User Management

### Creating Local Users
1. Navigate to Admin → Users
2. Click "New User"
3. Enter:
   - Email address
   - Display name
   - Initial password
   - Department (optional)
4. Assign to groups
5. Click "Create"

### User Properties
- **Email**: Unique identifier, used for login
- **Name**: Display name
- **Department**: Organizational unit
- **Status**: Active, Inactive, Locked
- **Auth Type**: Local or Entra

### Bulk Import
1. Admin → Users → Import
2. Upload CSV with format:
   ```csv
   email,name,department
   john@example.com,John Smith,Sales
   jane@example.com,Jane Doe,Marketing
   ```
3. Map columns
4. Import

### Deactivating Users
- Deactivated users cannot log in
- Their reports and data remain
- Reactivate at any time

## Group Management

### Creating Groups
1. Admin → Groups → New Group
2. Enter name and description
3. Configure permissions
4. Add members
5. Save

### Group Permissions

| Permission | Description |
|------------|-------------|
| `reports:view` | View reports in catalog |
| `reports:create` | Create new reports |
| `reports:edit` | Edit any report |
| `reports:delete` | Delete reports |
| `connections:view` | See available connections |
| `connections:create` | Create new connections |
| `connections:manage` | Edit/delete connections |
| `catalog:manage` | Manage categories and tags |
| `data:upload` | Upload Excel/CSV files |
| `admin:users` | Manage users |
| `admin:groups` | Manage groups |
| `admin:settings` | Modify system settings |

### Permission Inheritance
Permissions flow: Organization → Group → User

- Users get union of all their groups' permissions
- User-level overrides take precedence
- Organization defaults apply to all users

### Suggested Groups

**Viewers**
- `reports:view`
- `connections:view`

**Report Creators**
- All Viewer permissions
- `reports:create`
- `data:upload`

**Power Users**
- All Report Creator permissions
- `reports:edit`
- `connections:create`

**Administrators**
- All permissions

## Microsoft Entra ID Setup

### Prerequisites
- Azure AD tenant
- App registration permissions

### Azure Portal Configuration

1. **Create App Registration**
   - Azure Portal → Azure Active Directory → App registrations
   - New registration
   - Name: "Kinetic"
   - Supported account types: Choose appropriate option
   - Redirect URI: `https://your-kinetic-url/api/auth/entra/callback`

2. **Configure Authentication**
   - Platform: Web
   - Redirect URI: Add callback URL
   - ID tokens: Enable

3. **Create Client Secret**
   - Certificates & secrets → New client secret
   - Copy the secret value immediately

4. **API Permissions**
   - Add permissions:
     - `User.Read` (Delegated)
     - `GroupMember.Read.All` (Delegated) - for group sync
   - Grant admin consent

### Kinetic Configuration

Add to environment/appsettings:

```json
{
  "Entra": {
    "TenantId": "your-tenant-id",
    "ClientId": "your-client-id",
    "ClientSecret": "your-client-secret",
    "Instance": "https://login.microsoftonline.com/",
    "CallbackPath": "/api/auth/entra/callback",
    "GroupSync": {
      "Enabled": true,
      "SyncInterval": "0 */6 * * *"
    }
  }
}
```

### Group Sync
When enabled, Kinetic syncs Entra groups to local groups:
- Creates groups that don't exist
- Updates memberships
- Preserves local permissions

## Connection Management

### Creating Connections
1. Admin → Connections → New
2. Select connection type
3. Enter connection details:
   - Name (display name)
   - Host/Server
   - Port
   - Database name
   - Credentials
4. Test connection
5. Save

### Connection Types

**SQL Server**
```
Host: server.database.windows.net
Port: 1433
Database: MyDatabase
Options: TrustServerCertificate=True
```

**PostgreSQL**
```
Host: postgres.example.com
Port: 5432
Database: mydb
SSL Mode: Require (recommended)
```

**MySQL**
```
Host: mysql.example.com
Port: 3306
Database: mydb
```

**Oracle**
```
Host: oracle.example.com
Port: 1521
Service Name: ORCL
```

**MongoDB**
```
Connection String: mongodb://user:pass@host:27017/db
```

**Snowflake**
```
Account: account.snowflakecomputing.com
Warehouse: COMPUTE_WH
Database: MY_DB
Schema: PUBLIC
```

**BigQuery**
```
Project ID: my-project
Dataset: my_dataset
Credentials JSON: (upload service account key)
```

### Connection Security
- Credentials are encrypted at rest
- Use read-only database users
- Apply least-privilege principle
- Rotate credentials periodically

### Connection Sharing
Set visibility:
- **Private**: Only owner can use
- **Group**: Specific groups can use
- **Organization**: All users can use

## Category Management

### Creating Categories
1. Admin → Catalog → Categories
2. New Category
3. Enter name and description
4. Set icon/color
5. Save

### Category Hierarchy
Categories can be nested:
- Sales
  - Regional Sales
  - Product Sales
- Finance
  - Budget
  - Expenses

## Audit Logging

### Viewing Logs
Admin → Audit Logs

Filter by:
- Date range
- User
- Action type
- Resource

### Logged Events
- User login/logout
- Report create/edit/delete/execute
- Connection create/edit/delete
- Permission changes
- Admin actions

### Log Retention
Configure in settings:
- Default: 90 days
- Maximum: 365 days
- Export logs before deletion

### Export Logs
1. Set filters
2. Click Export
3. Choose format (CSV, JSON)

## System Settings

### General
- **Organization Name**: System-wide name
- **Default Time Zone**: For date displays
- **Date Format**: Date display format
- **Allow Registration**: Public signup

### Security
- **Session Timeout**: Auto-logout after inactivity
- **Max Login Attempts**: Lock after failures
- **Password Policy**: Complexity requirements
- **2FA**: Two-factor authentication options

### Performance
- **Max Concurrent Queries**: Per user/system
- **Query Timeout**: Maximum query duration
- **Max Export Rows**: Limit export size
- **Cache TTL Default**: Default cache duration

### Email
- **SMTP Server**: For notifications
- **From Address**: Sender address
- **Templates**: Customize email templates

## Backup & Recovery

### Database Backup
The Kinetic system database should be backed up regularly:

```sql
-- SQL Server
BACKUP DATABASE Kinetic TO DISK = '/backups/kinetic_backup.bak'
WITH FORMAT, COMPRESSION;
```

### Configuration Backup
Export configuration via API:
```bash
curl -X GET "https://kinetic/api/admin/export-config" \
  -H "Authorization: Bearer $TOKEN" \
  -o kinetic-config.json
```

### Recovery
1. Restore database from backup
2. Update connection strings if needed
3. Import configuration
4. Verify users and permissions

## Monitoring

### Health Checks
- `/health` - Basic health
- `/health/ready` - Readiness (all dependencies)
- `/health/live` - Liveness

### Metrics
Integrate with monitoring systems:
- Application Insights (Azure)
- Prometheus metrics endpoint
- Custom logging to SIEM

### Alerts
Configure alerts for:
- Failed logins (security)
- Query errors (reliability)
- High latency (performance)
- Disk usage (capacity)

## Troubleshooting

### Common Issues

**Users Can't Log In**
1. Check user status (not locked/inactive)
2. Verify password or Entra configuration
3. Check audit logs for errors
4. Test Entra connectivity

**Connection Failures**
1. Test connection from Kinetic server
2. Verify credentials
3. Check firewall rules
4. Verify database is running

**Slow Reports**
1. Check query execution time in audit
2. Review query plan in database
3. Add indexes if needed
4. Enable caching

**Permission Denied**
1. Check user's groups
2. Verify group permissions
3. Check resource visibility settings
4. Review permission inheritance

### Support Logs
Generate support bundle:
```bash
curl -X GET "https://kinetic/api/admin/support-bundle" \
  -H "Authorization: Bearer $TOKEN" \
  -o support-bundle.zip
```

Includes:
- System info
- Configuration (sanitized)
- Recent errors
- Performance metrics
