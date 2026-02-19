using System.Text.Json;
using Kinetic.Ingest.Models;

namespace Kinetic.Ingest.Parsers;

/// <summary>
/// Parses JSON data streams (newline-delimited JSON or JSON array)
/// </summary>
public class JsonDataParser : IDataParser
{
    public string Format => "json";

    public async IAsyncEnumerable<Dictionary<string, object?>> ParseAsync(
        Stream stream,
        IngestHeader header,
        Action<List<DetectedColumn>>? onColumnsDetected = null)
    {
        using var reader = new StreamReader(stream, leaveOpen: true);
        
        // Peek first character to determine format
        var firstChar = (char)reader.Peek();
        
        if (firstChar == '[')
        {
            // JSON Array format
            await foreach (var row in ParseJsonArrayAsync(reader, header, onColumnsDetected))
            {
                yield return row;
            }
        }
        else
        {
            // Newline-delimited JSON (NDJSON)
            await foreach (var row in ParseNdjsonAsync(reader, header, onColumnsDetected))
            {
                yield return row;
            }
        }
    }

    private async IAsyncEnumerable<Dictionary<string, object?>> ParseJsonArrayAsync(
        StreamReader reader,
        IngestHeader header,
        Action<List<DetectedColumn>>? onColumnsDetected)
    {
        var content = await reader.ReadToEndAsync();
        var array = JsonSerializer.Deserialize<JsonElement[]>(content);
        
        if (array == null || array.Length == 0)
            yield break;

        // Detect columns from first 100 rows
        var typeTracker = new Dictionary<string, TypeTracker>();
        var sampleCount = Math.Min(array.Length, 100);
        
        for (var i = 0; i < sampleCount; i++)
        {
            var element = array[i];
            if (element.ValueKind != JsonValueKind.Object)
                continue;

            foreach (var prop in element.EnumerateObject())
            {
                if (!typeTracker.ContainsKey(prop.Name))
                    typeTracker[prop.Name] = new TypeTracker();
                
                typeTracker[prop.Name].AddSample(prop.Value);
            }
        }

        var columns = DetectColumns(typeTracker, header.ColumnTypes);
        onColumnsDetected?.Invoke(columns);

        // Yield all rows
        foreach (var element in array)
        {
            if (element.ValueKind != JsonValueKind.Object)
                continue;

            yield return ConvertElement(element, columns);
        }
    }

    private async IAsyncEnumerable<Dictionary<string, object?>> ParseNdjsonAsync(
        StreamReader reader,
        IngestHeader header,
        Action<List<DetectedColumn>>? onColumnsDetected)
    {
        var typeTracker = new Dictionary<string, TypeTracker>();
        var sampleRows = new List<JsonElement>();
        var rowCount = 0;

        // Sample first 100 rows
        string? sampleLine;
        while (rowCount < 100 && (sampleLine = await reader.ReadLineAsync()) != null)
        {
            if (string.IsNullOrWhiteSpace(sampleLine))
                continue;

            try
            {
                var element = JsonSerializer.Deserialize<JsonElement>(sampleLine);
                if (element.ValueKind != JsonValueKind.Object)
                    continue;

                sampleRows.Add(element);
                
                foreach (var prop in element.EnumerateObject())
                {
                    if (!typeTracker.ContainsKey(prop.Name))
                        typeTracker[prop.Name] = new TypeTracker();
                    
                    typeTracker[prop.Name].AddSample(prop.Value);
                }
                
                rowCount++;
            }
            catch (JsonException)
            {
                // Skip invalid JSON lines
            }
        }

        var columns = DetectColumns(typeTracker, header.ColumnTypes);
        onColumnsDetected?.Invoke(columns);

        // Yield sample rows
        foreach (var element in sampleRows)
        {
            yield return ConvertElement(element, columns);
        }

        // Continue with remaining rows
        string? line;
        while ((line = await reader.ReadLineAsync()) != null)
        {
            if (string.IsNullOrWhiteSpace(line))
                continue;

            Dictionary<string, object?>? row = null;
            try
            {
                var element = JsonSerializer.Deserialize<JsonElement>(line);
                if (element.ValueKind == JsonValueKind.Object)
                {
                    row = ConvertElement(element, columns);
                }
            }
            catch (JsonException)
            {
                // Skip invalid JSON lines
            }

            if (row != null)
            {
                yield return row;
            }
        }
    }

    private static List<DetectedColumn> DetectColumns(
        Dictionary<string, TypeTracker> trackers,
        Dictionary<string, string>? typeHints)
    {
        var columns = new List<DetectedColumn>();
        
        foreach (var (name, tracker) in trackers)
        {
            var safeName = SanitizeColumnName(name);
            
            string sqlType;
            if (typeHints?.TryGetValue(name, out var hint) == true)
            {
                sqlType = hint;
            }
            else
            {
                sqlType = tracker.DetectSqlType();
            }

            columns.Add(new DetectedColumn
            {
                Name = safeName,
                SqlType = sqlType,
                Nullable = tracker.HasNulls,
                MaxLength = tracker.MaxLength > 0 ? tracker.MaxLength : null
            });
        }

        return columns;
    }

    private static Dictionary<string, object?> ConvertElement(JsonElement element, List<DetectedColumn> columns)
    {
        var row = new Dictionary<string, object?>();
        
        foreach (var col in columns)
        {
            object? value = null;
            
            // Find matching property (case-insensitive)
            foreach (var prop in element.EnumerateObject())
            {
                if (SanitizeColumnName(prop.Name) == col.Name)
                {
                    value = ConvertJsonValue(prop.Value, col.SqlType);
                    break;
                }
            }
            
            row[col.Name] = value;
        }

        return row;
    }

    private static object? ConvertJsonValue(JsonElement element, string sqlType)
    {
        if (element.ValueKind == JsonValueKind.Null || element.ValueKind == JsonValueKind.Undefined)
            return null;

        return sqlType.ToUpperInvariant() switch
        {
            "INT" => element.ValueKind == JsonValueKind.Number ? element.GetInt32() : null,
            "BIGINT" => element.ValueKind == JsonValueKind.Number ? element.GetInt64() : null,
            "DECIMAL(18,4)" => element.ValueKind == JsonValueKind.Number ? element.GetDecimal() : null,
            "BIT" => element.ValueKind == JsonValueKind.True ? true : 
                     element.ValueKind == JsonValueKind.False ? false : null,
            "DATETIME2" or "DATE" => DateTime.TryParse(element.GetString(), out var dt) ? dt : null,
            _ => element.ValueKind == JsonValueKind.String ? element.GetString() : element.ToString()
        };
    }

    private static string SanitizeColumnName(string name)
    {
        var sanitized = new string(name
            .Replace(' ', '_')
            .Replace('-', '_')
            .Where(c => char.IsLetterOrDigit(c) || c == '_')
            .ToArray());

        if (sanitized.Length > 0 && char.IsDigit(sanitized[0]))
            sanitized = "_" + sanitized;

        return string.IsNullOrEmpty(sanitized) ? "column" : sanitized;
    }

    private class TypeTracker
    {
        public int MaxLength { get; private set; }
        public bool HasNulls { get; private set; }
        
        private bool _allInts = true;
        private bool _allLongs = true;
        private bool _allDecimals = true;
        private bool _allBools = true;
        private bool _allDates = true;
        private int _sampleCount;

        public void AddSample(JsonElement element)
        {
            _sampleCount++;
            
            if (element.ValueKind == JsonValueKind.Null || element.ValueKind == JsonValueKind.Undefined)
            {
                HasNulls = true;
                return;
            }

            switch (element.ValueKind)
            {
                case JsonValueKind.Number:
                    _allBools = false;
                    _allDates = false;
                    
                    if (_allInts && !element.TryGetInt32(out _))
                        _allInts = false;
                    if (_allLongs && !element.TryGetInt64(out _))
                        _allLongs = false;
                    if (_allDecimals && !element.TryGetDecimal(out _))
                        _allDecimals = false;
                    break;

                case JsonValueKind.True:
                case JsonValueKind.False:
                    _allInts = false;
                    _allLongs = false;
                    _allDecimals = false;
                    _allDates = false;
                    break;

                case JsonValueKind.String:
                    var str = element.GetString() ?? "";
                    if (str.Length > MaxLength)
                        MaxLength = str.Length;
                    
                    _allInts = false;
                    _allLongs = false;
                    _allDecimals = false;
                    _allBools = false;
                    
                    if (_allDates && !DateTime.TryParse(str, out _))
                        _allDates = false;
                    break;

                default:
                    _allInts = false;
                    _allLongs = false;
                    _allDecimals = false;
                    _allBools = false;
                    _allDates = false;
                    
                    var json = element.ToString();
                    if (json.Length > MaxLength)
                        MaxLength = json.Length;
                    break;
            }
        }

        public string DetectSqlType()
        {
            if (_sampleCount == 0)
                return "NVARCHAR(255)";

            if (_allInts) return "INT";
            if (_allLongs) return "BIGINT";
            if (_allDecimals) return "DECIMAL(18,4)";
            if (_allBools) return "BIT";
            if (_allDates) return "DATETIME2";

            var size = MaxLength switch
            {
                <= 50 => 50,
                <= 100 => 100,
                <= 255 => 255,
                <= 500 => 500,
                <= 1000 => 1000,
                <= 4000 => 4000,
                _ => -1
            };

            return size == -1 ? "NVARCHAR(MAX)" : $"NVARCHAR({size})";
        }
    }
}
