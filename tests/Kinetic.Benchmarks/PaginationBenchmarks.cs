using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Jobs;

namespace Kinetic.Benchmarks;

[MemoryDiagnoser]
[SimpleJob(RuntimeMoniker.Net80)]
public class PaginationBenchmarks
{
    private List<Dictionary<string, object>> _dataset = null!;

    [GlobalSetup]
    public void Setup()
    {
        _dataset = new List<Dictionary<string, object>>(100000);
        for (var i = 0; i < 100000; i++)
        {
            _dataset.Add(new Dictionary<string, object>
            {
                ["id"] = i,
                ["name"] = $"Item {i}",
                ["value"] = i * 1.5,
                ["category"] = $"Cat_{i % 50}"
            });
        }
    }

    [Benchmark(Baseline = true)]
    [Arguments(0, 50)]
    [Arguments(1000, 50)]
    [Arguments(50000, 50)]
    public List<Dictionary<string, object>> Paginate_Skip_Take(int offset, int pageSize)
    {
        return _dataset.Skip(offset).Take(pageSize).ToList();
    }

    [Benchmark]
    [Arguments(0, 50)]
    [Arguments(1000, 50)]
    [Arguments(50000, 50)]
    public List<Dictionary<string, object>> Paginate_GetRange(int offset, int pageSize)
    {
        if (offset >= _dataset.Count) return new List<Dictionary<string, object>>();
        var count = Math.Min(pageSize, _dataset.Count - offset);
        return _dataset.GetRange(offset, count);
    }

    [Benchmark]
    [Arguments(0, 50)]
    [Arguments(1000, 50)]
    [Arguments(50000, 50)]
    public List<Dictionary<string, object>> Paginate_ArraySegment(int offset, int pageSize)
    {
        var array = _dataset.ToArray();
        if (offset >= array.Length) return new List<Dictionary<string, object>>();
        var count = Math.Min(pageSize, array.Length - offset);
        return new ArraySegment<Dictionary<string, object>>(array, offset, count).ToList();
    }

    [Benchmark]
    [Arguments(0, 50)]
    [Arguments(1000, 50)]
    [Arguments(50000, 50)]
    public List<Dictionary<string, object>> Paginate_Span(int offset, int pageSize)
    {
        var span = System.Runtime.InteropServices.CollectionsMarshal.AsSpan(_dataset);
        if (offset >= span.Length) return new List<Dictionary<string, object>>();
        var count = Math.Min(pageSize, span.Length - offset);
        return span.Slice(offset, count).ToArray().ToList();
    }
}
