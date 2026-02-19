using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Jobs;
using System.Text;
using System.Text.Json;

namespace Kinetic.Benchmarks;

[MemoryDiagnoser]
[SimpleJob(RuntimeMoniker.Net80)]
public class DataSerializationBenchmarks
{
    private List<Dictionary<string, object>> _smallDataset = null!;
    private List<Dictionary<string, object>> _mediumDataset = null!;
    private List<Dictionary<string, object>> _largeDataset = null!;
    private string _jsonSmall = null!;
    private string _jsonMedium = null!;
    private string _jsonLarge = null!;

    [GlobalSetup]
    public void Setup()
    {
        _smallDataset = GenerateDataset(100);
        _mediumDataset = GenerateDataset(1000);
        _largeDataset = GenerateDataset(10000);

        _jsonSmall = JsonSerializer.Serialize(_smallDataset);
        _jsonMedium = JsonSerializer.Serialize(_mediumDataset);
        _jsonLarge = JsonSerializer.Serialize(_largeDataset);
    }

    private List<Dictionary<string, object>> GenerateDataset(int count)
    {
        var result = new List<Dictionary<string, object>>(count);
        for (var i = 0; i < count; i++)
        {
            result.Add(new Dictionary<string, object>
            {
                ["id"] = i,
                ["name"] = $"Item {i}",
                ["description"] = $"This is a description for item {i} with some additional text",
                ["price"] = i * 10.5m,
                ["quantity"] = i % 100,
                ["created"] = DateTime.UtcNow.AddDays(-i),
                ["active"] = i % 2 == 0,
                ["category"] = $"Category {i % 10}"
            });
        }
        return result;
    }

    [Benchmark]
    public string Serialize_Small() => JsonSerializer.Serialize(_smallDataset);

    [Benchmark]
    public string Serialize_Medium() => JsonSerializer.Serialize(_mediumDataset);

    [Benchmark]
    public string Serialize_Large() => JsonSerializer.Serialize(_largeDataset);

    [Benchmark]
    public List<Dictionary<string, object>>? Deserialize_Small() => 
        JsonSerializer.Deserialize<List<Dictionary<string, object>>>(_jsonSmall);

    [Benchmark]
    public List<Dictionary<string, object>>? Deserialize_Medium() => 
        JsonSerializer.Deserialize<List<Dictionary<string, object>>>(_jsonMedium);

    [Benchmark]
    public List<Dictionary<string, object>>? Deserialize_Large() => 
        JsonSerializer.Deserialize<List<Dictionary<string, object>>>(_jsonLarge);

    [Benchmark]
    public byte[] SerializeToUtf8_Small() => JsonSerializer.SerializeToUtf8Bytes(_smallDataset);

    [Benchmark]
    public byte[] SerializeToUtf8_Large() => JsonSerializer.SerializeToUtf8Bytes(_largeDataset);
}
