using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.Tests;

public class ConnectionTestResultTests
{
    [Fact]
    public void Succeeded_ReturnsSuccessfulResult()
    {
        var result = ConnectionTestResult.Succeeded("PostgreSQL 15.1", "TestDB", TimeSpan.FromMilliseconds(50));
        
        Assert.True(result.Success);
        Assert.Null(result.Error);
        Assert.Equal("PostgreSQL 15.1", result.ServerVersion);
        Assert.Equal("TestDB", result.DatabaseName);
        Assert.Equal(TimeSpan.FromMilliseconds(50), result.ResponseTime);
    }

    [Fact]
    public void Failed_ReturnsFailedResult()
    {
        var result = ConnectionTestResult.Failed("Connection timeout");
        
        Assert.False(result.Success);
        Assert.Equal("Connection timeout", result.Error);
        Assert.Null(result.ServerVersion);
    }
}

public class QueryResultTests
{
    [Fact]
    public void Success_IsTrueWhenNoError()
    {
        var result = new QueryResult
        {
            Columns = new List<QueryColumn>
            {
                new() { Name = "id", DataType = "int" }
            },
            Rows = new List<Dictionary<string, object?>>
            {
                new() { ["id"] = 1 },
                new() { ["id"] = 2 }
            },
            TotalRows = 2
        };
        
        Assert.True(result.Success);
        Assert.Null(result.Error);
        Assert.Equal(2, result.Rows.Count);
    }

    [Fact]
    public void Success_IsFalseWhenError()
    {
        var result = new QueryResult
        {
            Error = "Syntax error"
        };
        
        Assert.False(result.Success);
    }
}

public class QueryColumnTests
{
    [Fact]
    public void QueryColumn_CanSetAllProperties()
    {
        var column = new QueryColumn
        {
            Name = "total_amount",
            DataType = "decimal",
            ClrType = typeof(decimal),
            IsNullable = false,
            MaxLength = null,
            Precision = 18,
            Scale = 2
        };
        
        Assert.Equal("total_amount", column.Name);
        Assert.Equal("decimal", column.DataType);
        Assert.Equal(typeof(decimal), column.ClrType);
        Assert.False(column.IsNullable);
        Assert.Equal(18, column.Precision);
        Assert.Equal(2, column.Scale);
    }
}

public class QueryOptionsTests
{
    [Fact]
    public void QueryOptions_DefaultValues()
    {
        var options = new QueryOptions();
        
        Assert.Null(options.MaxRows);
        Assert.Null(options.Offset);
        Assert.Null(options.Timeout);
        Assert.True(options.IncludeSchema);
    }

    [Fact]
    public void QueryOptions_CanSetPagination()
    {
        var options = new QueryOptions
        {
            MaxRows = 100,
            Offset = 50,
            Timeout = 30
        };
        
        Assert.Equal(100, options.MaxRows);
        Assert.Equal(50, options.Offset);
        Assert.Equal(30, options.Timeout);
    }
}

public class DatabaseSchemaTests
{
    [Fact]
    public void DatabaseSchema_CanHoldTables()
    {
        var schema = new DatabaseSchema
        {
            DatabaseName = "TestDB",
            Schemas = new List<SchemaInfo>
            {
                new() { Name = "public" },
                new() { Name = "reports" }
            },
            Tables = new List<TableInfo>
            {
                new() { Name = "users", Schema = "public", Type = "TABLE", RowCount = 1000 },
                new() { Name = "orders", Schema = "public", Type = "TABLE", RowCount = 50000 },
                new() { Name = "v_active_users", Schema = "public", Type = "VIEW" }
            }
        };
        
        Assert.Equal("TestDB", schema.DatabaseName);
        Assert.Equal(2, schema.Schemas.Count);
        Assert.Equal(3, schema.Tables.Count);
        Assert.Equal("VIEW", schema.Tables[2].Type);
    }
}

public class ColumnInfoTests
{
    [Fact]
    public void ColumnInfo_CanSetAllProperties()
    {
        var column = new ColumnInfo
        {
            Name = "customer_id",
            DataType = "int",
            IsNullable = false,
            IsPrimaryKey = true,
            IsAutoIncrement = true,
            OrdinalPosition = 1
        };
        
        Assert.Equal("customer_id", column.Name);
        Assert.True(column.IsPrimaryKey);
        Assert.True(column.IsAutoIncrement);
        Assert.False(column.IsNullable);
    }
}

public class QueryExecutionRequestTests
{
    [Fact]
    public void QueryExecutionRequest_DefaultValues()
    {
        var request = new QueryExecutionRequest
        {
            ConnectionString = "Host=localhost;Database=test",
            Query = "SELECT * FROM users"
        };
        
        Assert.Equal(30, request.TimeoutSeconds);
        Assert.True(request.IncludeSchema);
        Assert.False(request.IncludeTotalCount);
        Assert.Equal(SortDirection.Ascending, request.SortDirection);
        Assert.Empty(request.Parameters);
    }

    [Fact]
    public void QueryExecutionRequest_CanSetPagination()
    {
        var request = new QueryExecutionRequest
        {
            ConnectionString = "Host=localhost;Database=test",
            Query = "SELECT * FROM users",
            Page = 2,
            PageSize = 25
        };
        
        Assert.Equal(2, request.Page);
        Assert.Equal(25, request.PageSize);
    }
}

public class QueryExecutionResultTests
{
    [Fact]
    public void Failed_ReturnsFailedResult()
    {
        var result = QueryExecutionResult.Failed("Invalid SQL", "SQL001");
        
        Assert.False(result.Success);
        Assert.Equal("Invalid SQL", result.Error);
        Assert.Equal("SQL001", result.ErrorCode);
    }

    [Fact]
    public void QueryExecutionResult_CanCalculateTotalPages()
    {
        var result = new QueryExecutionResult
        {
            Success = true,
            TotalRows = 100,
            Page = 1,
            PageSize = 25,
            TotalPages = 4,
            RowsReturned = 25,
            HasMore = true
        };
        
        Assert.True(result.Success);
        Assert.Equal(4, result.TotalPages);
        Assert.True(result.HasMore);
    }
}
