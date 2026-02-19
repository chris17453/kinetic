using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Jobs;
using Microsoft.Data.SqlClient;
using System.Data;

namespace Kinetic.Benchmarks;

[MemoryDiagnoser]
[SimpleJob(RuntimeMoniker.Net80)]
public class QueryExecutionBenchmarks
{
    private string _connectionString = null!;
    private SqlConnection _connection = null!;

    [GlobalSetup]
    public void Setup()
    {
        _connectionString = Environment.GetEnvironmentVariable("BENCHMARK_MSSQL_CONNECTION") 
            ?? "Server=localhost;Database=Kinetic;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True";
        _connection = new SqlConnection(_connectionString);
        _connection.Open();
    }

    [GlobalCleanup]
    public void Cleanup()
    {
        _connection?.Close();
        _connection?.Dispose();
    }

    [Benchmark(Baseline = true)]
    public async Task<int> SimpleQuery_Small()
    {
        using var cmd = new SqlCommand("SELECT TOP 10 * FROM sys.objects", _connection);
        using var reader = await cmd.ExecuteReaderAsync();
        var count = 0;
        while (await reader.ReadAsync()) count++;
        return count;
    }

    [Benchmark]
    public async Task<int> SimpleQuery_Medium()
    {
        using var cmd = new SqlCommand("SELECT TOP 1000 * FROM sys.objects", _connection);
        using var reader = await cmd.ExecuteReaderAsync();
        var count = 0;
        while (await reader.ReadAsync()) count++;
        return count;
    }

    [Benchmark]
    public async Task<int> SimpleQuery_Large()
    {
        using var cmd = new SqlCommand("SELECT TOP 10000 * FROM sys.all_columns", _connection);
        using var reader = await cmd.ExecuteReaderAsync();
        var count = 0;
        while (await reader.ReadAsync()) count++;
        return count;
    }

    [Benchmark]
    public async Task<int> ParameterizedQuery()
    {
        using var cmd = new SqlCommand("SELECT * FROM sys.objects WHERE type = @type", _connection);
        cmd.Parameters.AddWithValue("@type", "U");
        using var reader = await cmd.ExecuteReaderAsync();
        var count = 0;
        while (await reader.ReadAsync()) count++;
        return count;
    }

    [Benchmark]
    public async Task<int> AggregateQuery()
    {
        using var cmd = new SqlCommand(@"
            SELECT type, COUNT(*) as cnt, MAX(create_date) as latest
            FROM sys.objects 
            GROUP BY type
            ORDER BY cnt DESC", _connection);
        using var reader = await cmd.ExecuteReaderAsync();
        var count = 0;
        while (await reader.ReadAsync()) count++;
        return count;
    }

    [Benchmark]
    public async Task<int> JoinQuery()
    {
        using var cmd = new SqlCommand(@"
            SELECT TOP 100 o.name, c.name as column_name, t.name as type_name
            FROM sys.objects o
            JOIN sys.columns c ON o.object_id = c.object_id
            JOIN sys.types t ON c.user_type_id = t.user_type_id
            ORDER BY o.name, c.column_id", _connection);
        using var reader = await cmd.ExecuteReaderAsync();
        var count = 0;
        while (await reader.ReadAsync()) count++;
        return count;
    }
}
