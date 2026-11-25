@echo off
chcp 65001 >nul
setlocal
title Painel v2 - Edificacoes Comuns x Empreendimentos de Impacto
cd /d "%~dp0"

echo ===================================================================
echo   Painel v2 - Edificacoes Comuns x Empreendimentos de Impacto
echo   DALU / Suplan - PBH
echo ===================================================================
echo.

REM --- 1. Verificacao dos arquivos de dados e bibliotecas -------------
set FALTA=0
for %%F in (index.html lib\leaflet.js lib\chart.min.js lib\proj4.js base\empreendimento_impacto_estudo_2.geojson base\edificacoes_2.geojson base\regional.geojson) do (
  if not exist "%%F" (
    echo [ERRO] Arquivo nao encontrado: %%F
    set FALTA=1
  )
)
if "%FALTA%"=="1" (
  echo.
  echo Verifique se a pasta "base" contem os GeoJSON e se a pasta "lib" esta completa.
  pause
  exit /b 1
)
echo [OK] Arquivos de dados e bibliotecas encontrados.

REM --- 2. Servidor PowerShell (padrao do Windows, sem instalacao) ------
where powershell >nul 2>nul
if %errorlevel%==0 (
  echo [OK] PowerShell disponivel. Iniciando servidor local...
  echo      O navegador abrira automaticamente. Mantenha esta janela aberta.
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Porta 8090
  if errorlevel 3 goto ALTERNATIVA
  goto FIM
)

:ALTERNATIVA
REM --- 3. Alternativa: Python (ativa .venv se existir) -----------------
echo.
echo [AVISO] Servidor PowerShell indisponivel. Tentando Python...
if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
  echo [OK] Ambiente virtual .venv ativado.
)
where python >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERRO] Nem PowerShell nem Python foram encontrados para iniciar o servidor local.
  echo        Instale o Python 3 ^(python.org^) ou habilite o PowerShell e tente novamente.
  pause
  exit /b 1
)
start "" "http://localhost:8091/index.html"
python -m http.server 8091 --bind 127.0.0.1
if errorlevel 1 (
  echo [ERRO] Falha ao iniciar o servidor Python na porta 8091.
)

:FIM
echo.
echo Servidor encerrado.
pause
endlocal
