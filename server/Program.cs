using System.Globalization;
using System.Text.Json;
using Microsoft.VisualBasic.FileIO;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(builder.Configuration["Server:Urls"] ?? "http://127.0.0.1:5262");

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
app.UseStaticFiles();

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

var hostedViewerIndex = Path.Combine(app.Environment.WebRootPath, "trends", "index.html");
var hostedViewerAvailable = File.Exists(hostedViewerIndex);

app.MapGet("/", () => Results.Redirect("/trends/"));
app.MapGet("/trends", () => Results.Redirect("/trends/"));

app.MapGet("/api/health", (IConfiguration configuration) =>
{
    var loadResult = TryLoadConfiguredCsv(configuration);
    return Results.Ok(new
    {
        status = loadResult.Exception is null ? "ok" : "degraded",
        timestampUtc = DateTime.UtcNow,
        note = "CSV-backed Unified Trend Viewer API",
        csvFolder = loadResult.CsvFolder,
        filePattern = loadResult.FilePattern,
        fileCount = loadResult.Files.Count,
        warningCount = loadResult.Warnings.Count,
        error = loadResult.Exception?.Message
    });
});

app.MapGet("/api/config", (IConfiguration configuration) =>
{
    var loadResult = TryLoadConfiguredCsv(configuration);
    return Results.Ok(new
    {
        csvFolder = loadResult.CsvFolder,
        filePattern = loadResult.FilePattern,
        fileCount = loadResult.Files.Count,
        availableFiles = loadResult.Files.Select(Path.GetFileName).ToArray(),
        warnings = loadResult.Warnings,
        error = loadResult.Exception?.Message
    });
});

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

    if (fromUtc > toUtc)
    {
        return Results.BadRequest(new { error = "The from date must be earlier than or equal to the to date." });
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

if (hostedViewerAvailable)
{
    app.MapFallbackToFile("/trends/{*path:nonfile}", "trends/index.html");
}
else
{
    app.MapGet("/trends/{*path}", () => Results.Content(
        """
        UnifiedTrendViewer API is running, but the hosted frontend has not been built yet.

        For local development:
        - run `npm run dev` for the Vite frontend, or
        - run `npm run build:web` to place the production frontend into `server/wwwroot/trends`
        """,
        "text/plain"));
}

app.Run();

static CsvLoadResult TryLoadConfiguredCsv(IConfiguration configuration)
{
    try
    {
        return LoadConfiguredCsv(configuration);
    }
    catch (Exception exception)
    {
        var (csvFolder, filePattern) = ResolveCsvSettings(configuration);
        return new CsvLoadResult("n/a", csvFolder, filePattern, Array.Empty<string>(), Array.Empty<TrendPointRecord>(), new[] { exception.Message }, exception);
    }
}

static CsvLoadResult LoadConfiguredCsv(IConfiguration configuration)
{
    var (csvFolder, filePattern) = ResolveCsvSettings(configuration);

    if (!Directory.Exists(csvFolder))
    {
        throw new DirectoryNotFoundException($"TrendData:CsvFolder does not exist: {csvFolder}");
    }

    var files = Directory.GetFiles(csvFolder, filePattern, System.IO.SearchOption.TopDirectoryOnly)
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
        ParseCsvFile(file, points, warnings);
    }

    return new CsvLoadResult(Path.GetFileName(files[0]), csvFolder, filePattern, files, points, warnings, null);
}

static (string CsvFolder, string FilePattern) ResolveCsvSettings(IConfiguration configuration)
{
    var csvFolder = configuration["TrendData:CsvFolder"];
    var filePattern = configuration["TrendData:FilePattern"] ?? "*.csv";

    if (string.IsNullOrWhiteSpace(csvFolder))
    {
        csvFolder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "sample-data"));
    }
    else
    {
        csvFolder = csvFolder
            .Replace('\\', Path.DirectorySeparatorChar)
            .Replace('/', Path.DirectorySeparatorChar);

        if (!Path.IsPathRooted(csvFolder))
        {
            csvFolder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, csvFolder));
        }
    }

    return (csvFolder, filePattern);
}

static void ParseCsvFile(string file, List<TrendPointRecord> points, List<string> warnings)
{
    using var parser = new TextFieldParser(file);
    parser.TextFieldType = FieldType.Delimited;
    parser.SetDelimiters(",");
    parser.HasFieldsEnclosedInQuotes = true;

    if (parser.EndOfData)
    {
        warnings.Add($"{Path.GetFileName(file)} is empty.");
        return;
    }

    var header = parser.ReadFields();
    if (header is null)
    {
        warnings.Add($"{Path.GetFileName(file)} has no header row.");
        return;
    }

    var timestampIndex = Array.IndexOf(header, "TimestampUTC");
    var tagIndex = Array.IndexOf(header, "TagName");
    var valueIndex = Array.IndexOf(header, "Value");
    var qualityIndex = Array.IndexOf(header, "Quality");

    if (timestampIndex < 0 || tagIndex < 0 || valueIndex < 0)
    {
        warnings.Add($"{Path.GetFileName(file)} is missing required columns.");
        return;
    }

    while (!parser.EndOfData)
    {
        var rowNumber = parser.LineNumber;
        string[]? fields;

        try
        {
            fields = parser.ReadFields();
        }
        catch (MalformedLineException)
        {
            warnings.Add($"{Path.GetFileName(file)} row {rowNumber} is malformed.");
            continue;
        }

        if (fields is null || fields.All(string.IsNullOrWhiteSpace))
        {
            continue;
        }

        if (fields.Length <= Math.Max(valueIndex, Math.Max(timestampIndex, tagIndex)))
        {
            warnings.Add($"{Path.GetFileName(file)} row {rowNumber} is malformed.");
            continue;
        }

        if (!DateTime.TryParse(fields[timestampIndex], CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var timestampUtc))
        {
            warnings.Add($"{Path.GetFileName(file)} row {rowNumber} has invalid timestamp.");
            continue;
        }

        double? value = null;
        if (double.TryParse(fields[valueIndex], CultureInfo.InvariantCulture, out var numericValue))
        {
            value = numericValue;
        }

        int? quality = null;
        if (qualityIndex >= 0 && fields.Length > qualityIndex && int.TryParse(fields[qualityIndex], out var numericQuality))
        {
            quality = numericQuality;
        }

        points.Add(new TrendPointRecord(timestampUtc, fields[tagIndex], value, quality));
    }
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
record CsvLoadResult(
    string SourceName,
    string CsvFolder,
    string FilePattern,
    IReadOnlyList<string> Files,
    IReadOnlyList<TrendPointRecord> Points,
    IReadOnlyList<string> Warnings,
    Exception? Exception);
