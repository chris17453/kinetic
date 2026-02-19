using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Jobs;
using System.Text.RegularExpressions;

namespace Kinetic.Benchmarks;

[MemoryDiagnoser]
[SimpleJob(RuntimeMoniker.Net80)]
public class ParameterInjectionBenchmarks
{
    private string _simpleQuery = null!;
    private string _complexQuery = null!;
    private Dictionary<string, object> _parameters = null!;
    private Regex _parameterRegex = null!;

    [GlobalSetup]
    public void Setup()
    {
        _simpleQuery = "SELECT * FROM users WHERE id = @userId AND status = @status";
        _complexQuery = @"
            SELECT u.id, u.name, u.email, o.order_id, o.total
            FROM users u
            JOIN orders o ON u.id = o.user_id
            WHERE u.department_id = @departmentId
              AND o.created_at >= @startDate
              AND o.created_at <= @endDate
              AND o.status IN (@status1, @status2, @status3)
              AND u.role = @role
              AND o.total >= @minAmount
            ORDER BY o.created_at DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY";

        _parameters = new Dictionary<string, object>
        {
            ["userId"] = 123,
            ["status"] = "active",
            ["departmentId"] = 5,
            ["startDate"] = DateTime.UtcNow.AddMonths(-1),
            ["endDate"] = DateTime.UtcNow,
            ["status1"] = "pending",
            ["status2"] = "processing",
            ["status3"] = "completed",
            ["role"] = "customer",
            ["minAmount"] = 100.00m,
            ["offset"] = 0,
            ["pageSize"] = 50
        };

        _parameterRegex = new Regex(@"@(\w+)", RegexOptions.Compiled);
    }

    [Benchmark(Baseline = true)]
    public string InjectParameters_Simple_StringReplace()
    {
        var query = _simpleQuery;
        foreach (var param in _parameters)
        {
            query = query.Replace($"@{param.Key}", FormatValue(param.Value));
        }
        return query;
    }

    [Benchmark]
    public string InjectParameters_Complex_StringReplace()
    {
        var query = _complexQuery;
        foreach (var param in _parameters)
        {
            query = query.Replace($"@{param.Key}", FormatValue(param.Value));
        }
        return query;
    }

    [Benchmark]
    public string InjectParameters_Simple_Regex()
    {
        return _parameterRegex.Replace(_simpleQuery, match =>
        {
            var key = match.Groups[1].Value;
            return _parameters.TryGetValue(key, out var value) ? FormatValue(value) : match.Value;
        });
    }

    [Benchmark]
    public string InjectParameters_Complex_Regex()
    {
        return _parameterRegex.Replace(_complexQuery, match =>
        {
            var key = match.Groups[1].Value;
            return _parameters.TryGetValue(key, out var value) ? FormatValue(value) : match.Value;
        });
    }

    [Benchmark]
    public List<string> ExtractParameters_Simple()
    {
        var matches = _parameterRegex.Matches(_simpleQuery);
        return matches.Select(m => m.Groups[1].Value).ToList();
    }

    [Benchmark]
    public List<string> ExtractParameters_Complex()
    {
        var matches = _parameterRegex.Matches(_complexQuery);
        return matches.Select(m => m.Groups[1].Value).ToList();
    }

    private static string FormatValue(object value)
    {
        return value switch
        {
            string s => $"'{s.Replace("'", "''")}'",
            DateTime dt => $"'{dt:yyyy-MM-dd HH:mm:ss}'",
            bool b => b ? "1" : "0",
            null => "NULL",
            _ => value.ToString() ?? "NULL"
        };
    }
}
