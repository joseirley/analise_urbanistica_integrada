$port = 8080
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener

try {
    $listener.Prefixes.Add($prefix)
    $listener.Start()
} catch {
    $port = 8085
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

$baseDir = $PSScriptRoot
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Servidor Web do Painel Urbanístico Iniciado com Sucesso!" -ForegroundColor Green
Write-Host " Acesse no seu navegador: $prefix" -ForegroundColor Yellow
Write-Host " Pressione Ctrl+C para encerrar o servidor." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

Start-Process $prefix

$mimeTypes = @{
    ".html"    = "text/html; charset=utf-8"
    ".css"     = "text/css; charset=utf-8"
    ".js"      = "application/javascript; charset=utf-8"
    ".json"    = "application/json; charset=utf-8"
    ".geojson" = "application/geo+json; charset=utf-8"
    ".png"     = "image/png"
    ".jpg"     = "image/jpeg"
    ".svg"     = "image/svg+xml"
    ".ico"     = "image/x-icon"
}

# Leitura segura de arquivos permitindo compartilhamento de leitura/escrita (ex: QGIS/editores abertos)
function Read-FileBytesSafe([string]$path) {
    $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
        $buffer = New-Object byte[] $fs.Length
        $totalRead = 0
        while ($totalRead -lt $buffer.Length) {
            $read = $fs.Read($buffer, $totalRead, $buffer.Length - $totalRead)
            if ($read -eq 0) { break }
            $totalRead += $read
        }
        return $buffer
    } finally {
        $fs.Close()
    }
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $urlPath = $request.Url.LocalPath.TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($urlPath)) {
                $urlPath = "index.html"
            }
            $urlPath = [System.Uri]::UnescapeDataString($urlPath).Replace('/', '\')
            $filePath = [System.IO.Path]::Combine($baseDir, $urlPath)

            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
            $response.AddHeader("Access-Control-Allow-Headers", "*")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 204
                $response.ContentLength64 = 0
            } elseif ([System.IO.File]::Exists($filePath)) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
                
                $bytes = Read-FileBytesSafe $filePath

                $response.StatusCode = 200
                $response.ContentType = $mime
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Nao Encontrado: $urlPath")
                $response.ContentType = "text/plain; charset=utf-8"
                $response.ContentLength64 = $msg.Length
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
        } finally {
            $response.Close()
        }
    } catch {
        # Conexão encerrada pelo cliente ou servidor parado
    }
}
