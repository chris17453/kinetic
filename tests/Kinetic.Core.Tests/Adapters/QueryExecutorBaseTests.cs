using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Reports;
using FluentAssertions;
using Xunit;

namespace Kinetic.Core.Tests.Adapters;

public class QueryExecutorBaseTests
{
    [Theory]
    [InlineData("validColumn", true)]
    [InlineData("schema_col", true)]
    [InlineData("col123", true)]
    [InlineData("first name", true)]    // spaces allowed by regex
    [InlineData("col; DROP TABLE", false)]
    [InlineData("col--comment", false)]
    [InlineData("col'injection", false)]
    [InlineData("col/*comment", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void ValidateSortColumn_AllowsOnlyAlphanumericAndSpaces(string? input, bool expectedValid)
    {
        // Use the concrete test executor
        var executor = new TestQueryExecutor();
        var result = executor.TestValidateSortColumn(input, null);
        
        if (expectedValid)
            result.Should().Be(input);
        else
            result.Should().BeNull();
    }

    [Fact]
    public void ValidateSortColumn_RespectsExplicitAllowList()
    {
        var executor = new TestQueryExecutor();
        var allowed = new[] { "name", "created_at", "status" };
        
        executor.TestValidateSortColumn("name", allowed).Should().Be("name");
        executor.TestValidateSortColumn("created_at", allowed).Should().Be("created_at");
        executor.TestValidateSortColumn("injected_col", allowed).Should().BeNull();
    }

    [Fact]
    public void ComputeQueryHash_IsDeterministic()
    {
        var executor = new TestQueryExecutor();
        var hash1 = executor.TestComputeHash("SELECT 1", new Dictionary<string, object?> { ["id"] = 42 });
        var hash2 = executor.TestComputeHash("SELECT 1", new Dictionary<string, object?> { ["id"] = 42 });
        hash1.Should().Be(hash2);
    }

    [Fact]
    public void ComputeQueryHash_DiffersOnDifferentParams()
    {
        var executor = new TestQueryExecutor();
        var hash1 = executor.TestComputeHash("SELECT 1", new Dictionary<string, object?> { ["id"] = 1 });
        var hash2 = executor.TestComputeHash("SELECT 1", new Dictionary<string, object?> { ["id"] = 2 });
        hash1.Should().NotBe(hash2);
    }

    // Test double exposing protected methods
    private class TestQueryExecutor : QueryExecutorBase
    {
        protected override System.Data.Common.DbConnection CreateConnection(string connectionString) => throw new NotSupportedException();
        protected override string WrapQueryForPagination(string query, int offset, int limit, string? sortColumn, SortDirection sortDirection) => query;
        protected override string WrapQueryForCount(string query) => $"SELECT COUNT(*) FROM ({query}) _c";

        public string? TestValidateSortColumn(string? col, IReadOnlyList<string>? allowed) => ValidateSortColumn(col, allowed);
        public string TestComputeHash(string query, Dictionary<string, object?> parameters) => ComputeQueryHash(query, parameters);
    }
}
