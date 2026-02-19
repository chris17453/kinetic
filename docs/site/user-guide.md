# User Guide

This guide covers how to use Kinetic as an end user to view and create reports.

## Logging In

### Local Login
1. Navigate to the login page
2. Enter your email and password
3. Click "Sign In"

### Microsoft Entra ID
1. Click "Sign in with Microsoft"
2. Complete Microsoft authentication
3. You'll be redirected back to Kinetic

## The Catalog

The Catalog is your home page for discovering and accessing reports.

### Browsing Reports
- **Grid View**: Visual cards showing report previews
- **List View**: Compact list with more details
- Toggle views using the icons in the top right

### Filtering Reports
- **Scope**: All, My Reports, Group Reports, Favorites
- **Category**: Filter by report category
- **Tags**: Filter by one or more tags
- **Search**: Full-text search across report names and descriptions

### Favorites
- Click the star icon on any report to add to favorites
- Access favorites quickly via the "Favorites" scope filter

### Ratings
- Rate reports 1-5 stars
- Help others discover high-quality reports

## Viewing Reports

### Running a Report
1. Click a report in the catalog
2. Fill in any required parameters:
   - Date ranges
   - Filters
   - Selections
3. Click "Run Report"
4. View results in table or chart format

### Parameters
Reports may have various input types:
- **Text**: Free-form text input
- **Number**: Numeric input with optional min/max
- **Date**: Date picker
- **Date Range**: Start and end date pickers
- **Select**: Dropdown with predefined options
- **Multi-Select**: Choose multiple options
- **User Picker**: Select users from your organization

### Visualizations
Switch between visualization types using tabs:
- **Table**: Sortable, filterable data grid
- **Bar Chart**: Vertical or horizontal bars
- **Line Chart**: Trend lines over time
- **Pie/Doughnut**: Proportional breakdown
- **KPI Cards**: Key metrics with trends
- More types depending on report configuration

### Table Features
- **Sort**: Click column headers to sort
- **Filter**: Use column filter inputs
- **Resize**: Drag column borders
- **Pagination**: Navigate through large datasets

### Exporting Data
1. Run the report
2. Click the Export button
3. Choose format:
   - **Excel**: Full data with formatting
   - **PDF**: Printable document with charts
   - **CSV**: Raw data for analysis

## Creating Reports

*Requires "Create Reports" permission*

### Report Builder Overview
1. Navigate to Reports → New Report
2. Complete each section:
   - Basic Info
   - Connection & Query
   - Parameters
   - Columns
   - Visualizations
   - Settings

### Step 1: Basic Info
- **Name**: Descriptive report name
- **Description**: What the report shows
- **Category**: Organize reports
- **Tags**: Additional categorization

### Step 2: Connection & Query
1. Select a database connection
2. Write your SQL query in the editor
3. Use @parameterName for dynamic values
4. Click "Test Query" to validate
5. View sample results

**Query Editor Features:**
- Syntax highlighting
- Auto-completion (tables, columns)
- Error highlighting
- Format SQL button

**Example Query:**
```sql
SELECT 
  department,
  COUNT(*) as employee_count,
  AVG(salary) as avg_salary
FROM employees
WHERE hire_date >= @startDate
  AND hire_date <= @endDate
  AND status = @status
GROUP BY department
ORDER BY employee_count DESC
```

### Step 3: Parameters
Add input fields for users running the report.

1. Click "Add Parameter"
2. Configure:
   - **Name**: Variable name (matches @name in query)
   - **Label**: Display name
   - **Type**: Input type (date, text, number, etc.)
   - **Required**: Must provide value
   - **Default**: Pre-filled value
   - **Validation**: Rules and error messages

**System Variables:**
Use these without defining parameters:
- `@_CurrentUserId` - Logged-in user's ID
- `@_CurrentUserEmail` - User's email
- `@_CurrentDepartment` - User's department
- `@_Today` - Current date
- `@_Now` - Current datetime

### Step 4: Columns
After testing your query, columns are auto-detected.

For each column:
- **Display Name**: Human-readable label
- **Visible**: Show/hide in results
- **Format**: Number, currency, date, percentage
- **Alignment**: Left, center, right
- **Width**: Column width

Drag to reorder columns.

### Step 5: Visualizations
Add one or more visualization types.

**Table Configuration:**
- Page size
- Sortable columns
- Filterable columns
- Export options

**Chart Configuration:**
- Chart type (bar, line, pie, etc.)
- X-axis column
- Y-axis column(s)
- Group by column
- Colors and labels
- Legend position

### Step 6: Settings
- **Auto-Run**: Execute immediately when opened
- **Cache Results**: Store in temp database
- **Cache TTL**: How long to keep cached results
- **Visibility**: Public, group, or private

### Saving and Publishing
1. Click "Save Report"
2. Choose visibility:
   - **Private**: Only you can see
   - **Group**: Specific groups can access
   - **Public**: All users in organization
3. Assign to category

## Data Upload

*Requires "Upload Data" permission*

Upload Excel or CSV files to create queryable tables.

### Upload Process
1. Navigate to Data → Upload
2. Drop files or click to browse
3. System analyzes file structure:
   - Sheets detected (Excel)
   - Columns and types inferred
   - Row count

### Configuration
For each sheet/file:
- **Table Name**: Name in database
- **Import**: Include or skip
- **Column Mapping**: If importing to existing table

### Options
- First row contains headers
- Truncate existing data
- Create indexes

### Creating Reports from Uploaded Data
1. Upload your data
2. Create a new connection pointing to your uploaded database
3. Build reports using the uploaded tables

## Tips & Best Practices

### Query Performance
- Always use appropriate WHERE clauses
- Limit results when testing
- Use indexes on filter columns
- Avoid SELECT * in production reports

### Report Organization
- Use descriptive names
- Add meaningful descriptions
- Assign appropriate categories
- Use tags for cross-category grouping

### Parameter Design
- Provide sensible defaults
- Use date ranges instead of single dates
- Limit dropdown options
- Add validation with clear error messages

### Visualization Selection
- Tables for detailed data exploration
- Bar charts for comparisons
- Line charts for trends over time
- Pie charts for composition (limited categories)
- KPIs for key metrics

## Troubleshooting

### Report Won't Run
- Check all required parameters are filled
- Verify parameter values are valid
- Check connection is still accessible

### Slow Performance
- Reduce date ranges
- Add more specific filters
- Contact admin about query optimization
- Enable caching for frequently-run reports

### Export Issues
- Large exports may take time
- Try exporting smaller date ranges
- Check browser allows downloads
