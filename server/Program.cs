using System.Globalization;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();
app.UseCors();

var presets = new[]
{
    new TrendPreset("Hydraulics", "Hydraulics", "Hydraulic pressures and flows", new[] { "Vehicle_HP_Pressure", "Vehicle_LP_Pressure", "Vehicle_LP_Flow" }),
    new TrendPreset("Jetting", "Jetting", "Jetting pressure trends", new[] { "Jetting_Pressure" }),
    new TrendPreset("Pumps", "Pumps", "Pump and hydraulic load indicators", new[] { "Vehicle_HP_Pressure", "Vehicle_LP_Flow" }),
    new TrendPreset("Steering", "Steering", "Track steering speeds", new[] { "Track_Left_Speed", "Track_Right_Speed" }),
    new TrendPreset("Cutter", "Cutter", "Cutter speed and jetting interaction", new[] { "Cutter_Speed", "Jetting_Pressure" }),
    new TrendPreset("Thrusters", "Thrusters", "Thruster and track motion indicators", new[] { "Track_Left_Speed", "Track_Right_Speed" }),
    new TrendPreset("Custom", "Custom", "Operator-selected tag set", Array.Empty<string>()),
};

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    timestampUtc = DateTime.UtcNow,
    note = "CSV-backed Unified Trend Viewer API"
}));

app.MapGet("/api/presets", () => Results.Ok(presets));

app.MapGet("/api/tags", (IConfiguration configuration) =>
{
    var loadResult = LoadConfiguredCsv(configuration);
    return Results.Ok(new
    {
        tags = loadResult.Points.Select(point => point.TagName).Distinct().OrderBy(tag => tag).ToArray(),
        warnings = loadResult.Warnings
    });
});

app.MapGet("/api/trend", (HttpRequest request, IConfiguration configuration) =>
{
    var tags = (request.Query["tags"].ToString() ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    if (tags.Length == 0)
    {
        return Results.BadRequest(new { error = "At least one tag must be supplied in the tags query string." });
    }

    if (!DateTime.TryParse(request.Query["from"], CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var fromUtc) ||
        !DateTime.TryParse(request.Query["to"], CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var toUtc))
    {
        return Results.BadRequest(new { error = "Valid from/to UTC date values are required." });
    }

    var loadResult = LoadConfiguredCsv(configuration);
    var selectedTags = tags.ToHashSet(StringComparer.OrdinalIgnoreCase);
    var filtered = loadResult.Points
        .Where(point => selectedTags.Contains(point.TagName) && point.TimestampUtc >= fromUtc && point.TimestampUtc <= toUtc)
        .OrderBy(point => point.TimestampUtc)
        .ToList();

    var series = filtered
        .GroupBy(point => point.TagName)
        .OrderBy(group => group.Key)
        .Select(group =>
        {
            var items = group.OrderBy(point => point.TimestampUtc).ToList();
            var numeric = items.Where(point => point.Value.HasValue).Select(point => point.Value!.Value).ToArray();
            var badQualityCount = items.Count(point => point.Quality.HasValue && point.Quality.Value < 192);

            return new
            {
                tagName = group.Key,
                points = items.Select(point => new
                {
                    timestampUtc = point.TimestampUtc.ToString("O"),
                    tagName = point.TagName,
                    value = point.Value,
                    quality = point.Quality,
                    qualityText = DescribeQuality(point.Quality)
                }),
                summary = new
                {
                    tagName = group.Key,
                    latestValue = numeric.Length > 0 ? numeric[^1] : (double?)null,
                    minValue = numeric.Length > 0 ? numeric.Min() : (double?)null,
                    maxValue = numeric.Length > 0 ? numeric.Max() : (double?)null,
                    averageValue = numeric.Length > 0 ? numeric.Average() : (double?)null,
                    qualitySummary = badQualityCount > 0 ? $"{badQualityCount} non-good samples" : "Good"
                }
            };
        })
        .ToList();

    return Results.Ok(new
    {
        fromUtc = fromUtc.ToString("O"),
        toUtc = toUtc.ToString("O"),
        sourceName = loadResult.SourceName,
        totalPoints = filtered.Count,
        warnings = loadResult.Warnings,
        series = series.Select(entry => new { entry.tagName, entry.points }),
        summaries = series.Select(entry => entry.summary)
    });
});

app.Run();

static CsvLoadResult LoadConfiguredCsv(IConfiguration configuration)
{
    var csvFolder = configuration["TrendData:CsvFolder"];
    var filePattern = configuration["TrendData:FilePattern"] ?? "*.csv";

    if (string.IsNullOrWhiteSpace(csvFolder))
    {
        csvFolder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "sample-data"));
    }
    else if (!Path.IsPathRooted(csvFolder))
    {
        csvFolder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, csvFolder));
    }

    if (!Directory.Exists(csvFolder))
    {
        throw new DirectoryNotFoundException($"TrendData:CsvFolder does not exist: {csvFolder}");
    }

    var files = Directory.GetFiles(csvFolder, filePattern, SearchOption.TopDirectoryOnly)
        .OrderBy(file => file)
        .ToArray();

    if (files.Length == 0)
    {
        throw new FileNotFoundException($"No CSV files were found in {csvFolder} matching {filePattern}.");
    }

    var warnings = new List<string>();
    var points = new List<TrendPointRecord>();

    foreach (var file in files)
    {
        var lines = File.ReadAllLines(file);
        if (lines.Length <= 1)
        {
            warnings.Add($"{Path.GetFileName(file)} is empty.");
            continue;
        }

        var header = lines[0].Split(',');
        var timestampIndex = Array.IndexOf(header, "TimestampUTC");
        var tagIndex = Array.IndexOf(header, "TagName");
        var valueIndex = Array.IndexOf(header, "Value");
        var qualityIndex = Array.IndexOf(header, "Quality");

        if (timestampIndex < 0 || tagIndex < 0 || valueIndex < 0)
        {
            warnings.Add($"{Path.GetFileName(file)} is missing required columns.");
            continue;
        }

        for (var i = 1; i < lines.Length; i++)
        {
            var line = lines[i];
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var parts = line.Split(',');
            if (parts.Length <= Math.Max(valueIndex, Math.Max(timestampIndex, tagIndex)))
            {
                warnings.Add($"{Path.GetFileName(file)} row {i + 1} is malformed.");
                continue;
            }

            if (!DateTime.TryParse(parts[timestampIndex], CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var timestampUtc))
            {
                warnings.Add($"{Path.GetFileName(file)} row {i + 1} has invalid timestamp.");
                continue;
            }

            double? value = null;
            if (double.TryParse(parts[valueIndex], CultureInfo.InvariantCulture, out var numericValue))
            {
                value = numericValue;
            }

            int? quality = null;
            if (qualityIndex >= 0 && parts.Length > qualityIndex && int.TryParse(parts[qualityIndex], out var numericQuality))
            {
                quality = numericQuality;
            }

            points.Add(new TrendPointRecord(timestampUtc, parts[tagIndex], value, quality));
        }
    }

    return new CsvLoadResult(Path.GetFileName(files[0]), points, warnings);
}

static string DescribeQuality(int? quality)
{
    if (quality is null)
    {
        return "n/a";
    }

    if (quality == 192)
    {
        return "Good";
    }

    if (quality >= 128)
    {
        return "Uncertain";
    }

    return "Bad";
}

record TrendPreset(string Id, string Name, string Description, string[] TagNames);
record TrendPointRecord(DateTime TimestampUtc, string TagName, double? Value, int? Quality);
record CsvLoadResult(string SourceName, IReadOnlyList<TrendPointRecord> Points, IReadOnlyList<string> Warnings);
