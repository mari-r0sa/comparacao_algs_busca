using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 50 * 1024 * 1024; // 50 MB total request size.
});

var app = builder.Build();

var rootPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, ".."));
var filesPath = Path.Combine(rootPath, "files");
Directory.CreateDirectory(filesPath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(rootPath)
});

app.MapGet("/", () => Results.File(Path.Combine(rootPath, "index.html"), "text/html"));

app.MapPost("/upload", async (HttpRequest request) =>
{
    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { message = "A requisição precisa ser multipart/form-data." });
    }

    var form = await request.ReadFormAsync();
    var uploadedFiles = form.Files;

    if (uploadedFiles.Count == 0)
    {
        return Results.BadRequest(new { message = "Selecione pelo menos um arquivo." });
    }

    var saved = new List<string>();

    foreach (var file in uploadedFiles)
    {
        if (file.Length == 0)
        {
            continue;
        }

        var safeName = Path.GetFileName(file.FileName);
        var destinationPath = Path.Combine(filesPath, safeName);

        await using var stream = File.Create(destinationPath);
        await file.CopyToAsync(stream);

        saved.Add(safeName);
    }

    if (saved.Count == 0)
    {
        return Results.BadRequest(new { message = "Nenhum arquivo válido foi enviado." });
    }

    return Results.Ok(new
    {
        message = "Upload concluído com sucesso.",
        files = saved
    });
});

app.Run();
