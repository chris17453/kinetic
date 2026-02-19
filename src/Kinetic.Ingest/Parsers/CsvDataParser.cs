using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Kinetic.Ingest.Models;

namespace Kinetic.Ingest.Parsers;

/// <summary>
/// Parses CSV data streams
/// </summary>
public class CsvDataParser : IDataParser
{
    public string Format => "csv";

    public async IAsyncEnumerable<Dictionary<string, object?>> ParseAsync(
        Stream stream,
        IngestHeader header,
        Action<List<DetectedColumn>>? onColumnsDetected = null)
    {
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            Delimiter = header.Delimiter.ToString(),
            HasHeaderRecord = header.HasHeaders,
            MissingFieldFound = null,
            BadDataFound = null,
            TrimOptions = TrimOptions.Trim,
        };

        using var reader = new StreamReader(stream, leaveOpen: true);
        using var csv = new CsvReader(reader, config);

        await csv.ReadAsync();
        
        string[] headers;
        if (header.HasHeaders)
        {
            csv.ReadHeader();
            headers = csv.HeaderRecord ?? throw new InvalidOperationException("No headers found");
        }
        else
        {
            // Generate column names col_0, col_1, etc.
            var fieldCount = csv.Parser.Count;
            headers = Enumerable.Range(0, fieldCount).Select(i => $"col_{i}").ToArray();
        }

        // Track types for detection
        var typeTracker = new Dictionary<string, TypeTracker>();
        foreach (var h in headers)
        {
            typeTracker[h] = new TypeTracker();
        }

        var rowCount = 0;
        var sampleRows = new List<Dictionary<string, object?>>();

        // First pass: sample rows to detect types
        while (await csv.ReadAsync() && rowCount < 100)
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < headers.Length; i++)
            {
                var value = csv.GetField(i);
                row[headers[i]] = value;
                typeTracker[headers[i]].AddSample(value);
            }
            sampleRows.Add(row);
            rowCount++;
        }

        // Detect columns
        var columns = DetectColumns(headers, typeTracker, header.ColumnTypes);
        onColumnsDetected?.Invoke(columns);

        // Yield sample rows
        foreach (var row in sampleRows)
        {
            yield return ConvertRow(row, columns);
        }

        // Continue with remaining rows
        while (await csv.ReadAsync())
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < headers.Length; i++)
            {
                row[headers[i]] = csv.GetField(i);
            }
            yield return ConvertRow(row, columns);
        }
    }

    private static List<DetectedColumn> DetectColumns(
        string[] headers, 
        Dictionary<string, TypeTracker> trackers,
        Dictionary<string, string>? typeHints)
    {
        var columns = new List<DetectedColumn>();
        
        foreach (var header in headers)
        {
            var safeName = SanitizeColumnName(header);
            var tracker = trackers[header];
            
            string sqlType;
            if (typeHints?.TryGetValue(header, out var hint) == true)
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

    private static Dictionary<string, object?> ConvertRow(
        Dictionary<string, object?> row, 
        List<DetectedColumn> columns)
    {
        var converted = new Dictionary<string, object?>();
        
        foreach (var col in columns)
        {
            var originalName = row.Keys.FirstOrDefault(k => SanitizeColumnName(k) == col.Name);
            if (originalName == null) continue;
            
            var value = row[originalName] as string;
            converted[col.Name] = ConvertValue(value, col.SqlType);
        }

        return converted;
    }

    private static object? ConvertValue(string? value, string sqlType)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return sqlType.ToUpperInvariant() switch
        {
            "INT" => int.TryParse(value, out var i) ? i : null,
            "BIGINT" => long.TryParse(value, out var l) ? l : null,
            "DECIMAL(18,4)" => decimal.TryParse(value, out var d) ? d : null,
            "BIT" => ParseBool(value),
            "DATETIME2" => DateTime.TryParse(value, out var dt) ? dt : null,
            "DATE" => DateTime.TryParse(value, out var date) ? date.Date : null,
            _ => value
        };
    }

    private static bool? ParseBool(string value)
    {
        var lower = value.ToLowerInvariant();
        return lower switch
        {
            "true" or "1" or "yes" or "y" => true,
            "false" or "0" or "no" or "n" => false,
            _ => null
        };
    }

    private static string SanitizeColumnName(string name)
    {
        // Remove invalid characters, replace spaces with underscores
        var sanitized = new string(name
            .Replace(' ', '_')
            .Replace('-', '_')
            .Where(c => char.IsLetterOrDigit(c) || c == '_')
            .ToArray());

        // Ensure doesn't start with number
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
        private bool _allDateTimes = true;
        private int _sampleCount;

        public void AddSample(string? value)
        {
            _sampleCount++;
            
            if (string.IsNullOrWhiteSpace(value))
            {
                HasNulls = true;
                return;
            }

            if (value.Length > MaxLength)
                MaxLength = value.Length;

            if (_allInts && !int.TryParse(value, out _))
                _allInts = false;

            if (_allLongs && !long.TryParse(value, out _))
                _allLongs = false;

            if (_allDecimals && !decimal.TryParse(value, out _))
                _allDecimals = false;

            if (_allBools && !IsBoolish(value))
                _allBools = false;

            if (_allDateTimes && !DateTime.TryParse(value, out _))
            {
                _allDateTimes = false;
                _allDates = false;
            }
            else if (_allDates && DateTime.TryParse(value, out var dt) && dt.TimeOfDay != TimeSpan.Zero)
            {
                _allDates = false;
            }
        }

        private static bool IsBoolish(string value)
        {
            var lower = value.ToLowerInvariant();
            return lower is "true" or "false" or "1" or "0" or "yes" or "no" or "y" or "n";
        }

        public string DetectSqlType()
        {
            if (_sampleCount == 0 || HasNulls && _sampleCount <= 1)
                return $"NVARCHAR({Math.Max(50, MaxLength * 2)})";

            if (_allInts) return "INT";
            if (_allLongs) return "BIGINT";
            if (_allDecimals) return "DECIMAL(18,4)";
            if (_allBools) return "BIT";
            if (_allDates) return "DATE";
            if (_allDateTimes) return "DATETIME2";

            var size = MaxLength switch
            {
                <= 50 => 50,
                <= 100 => 100,
                <= 255 => 255,
                <= 500 => 500,
                <= 1000 => 1000,
                <= 4000 => 4000,
                _ => -1 // MAX
            };

            return size == -1 ? "NVARCHAR(MAX)" : $"NVARCHAR({size})";
        }
    }
}
