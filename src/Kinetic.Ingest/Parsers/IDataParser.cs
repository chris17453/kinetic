using Kinetic.Ingest.Models;

namespace Kinetic.Ingest.Parsers;

/// <summary>
/// Interface for data parsers
/// </summary>
public interface IDataParser
{
    string Format { get; }
    
    IAsyncEnumerable<Dictionary<string, object?>> ParseAsync(
        Stream stream,
        IngestHeader header,
        Action<List<DetectedColumn>>? onColumnsDetected = null);
}

/// <summary>
/// Factory for creating data parsers
/// </summary>
public class DataParserFactory
{
    private readonly Dictionary<string, IDataParser> _parsers;

    public DataParserFactory()
    {
        _parsers = new Dictionary<string, IDataParser>(StringComparer.OrdinalIgnoreCase)
        {
            ["csv"] = new CsvDataParser(),
            ["json"] = new JsonDataParser(),
            ["ndjson"] = new JsonDataParser(),
        };
    }

    public IDataParser GetParser(string format)
    {
        if (_parsers.TryGetValue(format, out var parser))
            return parser;

        throw new NotSupportedException($"Format '{format}' is not supported. Supported formats: {string.Join(", ", _parsers.Keys)}");
    }

    public bool IsSupported(string format) => _parsers.ContainsKey(format);
}
