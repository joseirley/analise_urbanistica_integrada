# ==========================================================================
#  Servidor HTTP local do Painel v2 (PowerShell, sem dependências externas)
#  Serve apenas arquivos dentro da pasta do painel (somente leitura).
# ==========================================================================
param([int]$Porta = 8090)

$ErrorActionPreference = 'Stop'
$baseDir = $PSScriptRoot
$baseFull = [System.IO.Path]::GetFullPath($baseDir)

# Verificação de arquivos obrigatórios antes de subir o servidor
$obrigatorios = @(
  'index.html', 'lib\leaflet.js', 'lib\chart.min.js', 'lib\proj4.js',
  'base\empreendimento_impacto_estudo_2.geojson', 'base\edificacoes_2.geojson', 'base\regional.geojson'
)
$faltando = $obrigatorios | Where-Object { -not (Test-Path (Join-Path $baseDir $_)) }
if ($faltando) {
  Write-Host ''
  Write-Host ' ERRO: arquivos necessarios nao encontrados:' -ForegroundColor Red
  $faltando | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
  Write-Host ' Verifique se a pasta "base" contem os GeoJSON e se a pasta "lib" esta completa.' -ForegroundColor Yellow
  exit 2
}

# Tenta a porta solicitada e as seguintes, caso estejam ocupadas
$listener = $null
foreach ($p in $Porta..($Porta + 9)) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start()
    $listener = $l; $Porta = $p; break
  } catch { }
}
if (-not $listener) {
  Write-Host " ERRO: nao foi possivel abrir um servidor nas portas $Porta a $($Porta + 9)." -ForegroundColor Red
  Write-Host ' Feche outros servidores locais ou execute como usuario com permissao de rede local.' -ForegroundColor Yellow
  exit 3
}

$url = "http://localhost:$Porta/"
Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host ' Painel v2 - Edificacoes Comuns x Empreendimentos de Impacto' -ForegroundColor Green
Write-Host " Endereco: $url" -ForegroundColor Yellow
Write-Host ' Mantenha esta janela aberta. Ctrl+C para encerrar.' -ForegroundColor Gray
Write-Host '==========================================================' -ForegroundColor Cyan
Start-Process $url

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.geojson' = 'application/geo+json; charset=utf-8'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
}

function Ler-Arquivo([string]$caminho) {
  # FileShare.ReadWrite permite ler arquivos abertos no QGIS/editores
  $fs = New-Object System.IO.FileStream($caminho, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $buf = New-Object byte[] $fs.Length; $lido = 0
    while ($lido -lt $buf.Length) { $n = $fs.Read($buf, $lido, $buf.Length - $lido); if ($n -eq 0) { break }; $lido += $n }
    return $buf
  } finally { $fs.Close() }
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext(); $req = $ctx.Request; $res = $ctx.Response
    try {
      $rel = [System.Uri]::UnescapeDataString($req.Url.LocalPath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
      $arq = [System.IO.Path]::GetFullPath((Join-Path $baseDir ($rel -replace '/', '\')))
      $res.AddHeader('Cache-Control', 'no-cache')
      if (-not $arq.StartsWith($baseFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $res.StatusCode = 403
      } elseif ([System.IO.File]::Exists($arq)) {
        $ext = [System.IO.Path]::GetExtension($arq).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $bytes = Ler-Arquivo $arq
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - nao encontrado: $rel")
        $res.ContentType = 'text/plain; charset=utf-8'; $res.ContentLength64 = $msg.Length
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
    } finally { $res.Close() }
  } catch { }
}
