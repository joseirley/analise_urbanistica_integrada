# Análise Urbanística Integrada — Edificações Comuns × Empreendimentos de Impacto

Painel de BI geoespacial da Prefeitura de Belo Horizonte para comparar **edificações comuns** (que não passam pelo licenciamento de impacto) com **empreendimentos de impacto**. O foco é a ocupação territorial, o adensamento e as **edificações médias**, que ficam próximas aos limiares de enquadramento como impacto.

**🌐 Acesse o painel:** https://joseirley.github.io/analise_urbanistica_integrada/

| | |
|---|---|
| **Órgão responsável** | Diretoria de Análise de Licenciamentos Urbanísticos Especiais (DALU) / Subsecretaria de Planejamento Urbano (Suplan) |
| **Base legal** | Art. 345 da Lei Municipal nº 11.181/2019 (Plano Diretor de Belo Horizonte) |
| **Fonte dos dados** | Banco de Dados Suplan (2020–2026) e Censo Demográfico IBGE (2022) |
| **Dados de referência** | novembro/2026 |
| **Versão** | 2.0 (ver [CHANGELOG](CHANGELOG.md)) |

---

## O que o painel faz

- **Página de introdução**: explica objetivo, contexto, bases, tratamento dos dados e filtros. O botão **Ir para o relatório** abre o painel, e **← Introdução** volta. O endereço com `#painel` abre direto no relatório.
- **Mapa interativo**: edificações comuns, empreendimentos de impacto, regionais e densidade de edificações (kernel com raio ajustável em metros). Cada camada pode ser ligada e desligada e tem controle de opacidade. O mapa de fundo alterna entre *Street* e *Satellite*.
- **Filtro especial "Edificações Médias"**: mostra apenas as edificações comuns próximas aos limiares de impacto (vagas 100–400 **ou** unidades 96–300 **ou** área 6.000–20.000 m²).
- **Filtros** de empreendimento de impacto, regional, bairro, uso, enquadramento e faixas numéricas (unidades, vagas, área, população), em listas suspensas com seleção múltipla.
- **Seleção de um empreendimento de impacto**: filtra as edificações comuns do mesmo bairro e monta a comparação entre eles.
- **Indicadores** separados por grupo: edificações comuns, médias e impacto.
- **Comparativo comuns × médias × impacto**: totais, média por registro e participação de cada grupo. Funciona mesmo quando não há edificações médias no recorte.
- **Gráficos com filtragem cruzada**, no estilo do Power BI: clicar numa barra filtra todo o painel. Seleções em gráficos diferentes se combinam, e clicar de novo desmarca.
- **Distribuições por faixa** com a soma do próprio dado (unidades, vagas, área, população) para cada grupo, todos no mesmo eixo.
- **Relatório em PDF** com os dados em tela: filtros, indicadores, mapa, tabela comparativa e gráficos, cada um com uma breve explicação.

Guia de uso: [docs/GUIA_DE_USO.md](docs/GUIA_DE_USO.md) · Metodologia e dicionário de dados: [docs/METODOLOGIA.md](docs/METODOLOGIA.md)

---

## Como executar localmente

1. Baixe o repositório (botão **Code → Download ZIP**) ou clone-o com `git clone`.
2. Dê dois cliques em **`iniciar_painel.bat`**. O navegador abre em `http://localhost:8090/`.

Requisitos: Windows com PowerShell (padrão no Windows 10/11). Nada precisa ser instalado, porque todas as bibliotecas estão em `lib/`. Se o PowerShell não puder abrir a porta, o script tenta o Python (`python -m http.server`).

> Não abra o `index.html` com duplo clique (`file://`): o navegador bloqueia a leitura dos GeoJSON. Use o `.bat` ou o endereço publicado.

Os mapas de fundo (OpenStreetMap e Esri) exigem internet; filtros, gráficos e relatório funcionam sem ela.

---

## Publicação (GitHub Pages)

O site é publicado pelo GitHub Pages a partir da **raiz do branch `main`**. Qualquer alteração enviada ao `main` é publicada automaticamente em alguns minutos. O arquivo `.nojekyll` faz o Pages servir os arquivos como estão.

**Cache do navegador:** no `index.html`, os arquivos CSS e JS são carregados com um número de versão (`?v=2.0.3`). A cada nova publicação, aumente esse número (buscar e substituir no `index.html`), para que os navegadores não misturem a página nova com estilos ou scripts antigos guardados em cache.

---

## Estrutura do repositório

```
├── index.html                # Introdução + relatório (página publicada)
├── css/styles.css
├── js/
│   ├── config.js             # Campos reais, limiares, faixas, cores, mapas de fundo, data de referência
│   ├── normalize.js          # Uniformização de uso, enquadramento e números
│   ├── data-loader.js        # Carga única, validação e montagem dos registros
│   ├── filter-state.js       # Estado global único de filtros
│   ├── filter-engine.js      # Filtragem e agregações (funções puras)
│   ├── kde.js                # Densidade kernel quártica em metros (EPSG:31983)
│   ├── validation.js         # Verificações de consistência a cada atualização
│   ├── map-view.js           # Mapa, camadas, quadro do ponto, Street/Satellite
│   ├── charts-view.js        # Gráficos com filtragem cruzada
│   ├── sidebar-view.js       # Camadas e filtros (listas suspensas)
│   ├── panels-view.js        # Indicadores, etiquetas, comparativos
│   ├── intro.js              # Página de introdução e navegação introdução ⇄ relatório
│   ├── report-pdf.js         # Relatório PDF
│   ├── util.js               # Formatação pt-BR
│   └── app.js                # Orquestração
├── lib/                      # Leaflet 1.9.4, Chart.js 4.4.2, Proj4js, pdf-lib 1.17.1
├── assets/logo-pbh.svg
├── base/                     # Dados (GeoJSON, EPSG:31983)
│   ├── empreendimento_impacto_estudo_2.geojson
│   ├── edificacoes_2.geojson
│   └── regional.geojson
├── tests/                    # Validação independente (Python) e testes automatizados
├── docs/
│   ├── GUIA_DE_USO.md
│   └── METODOLOGIA.md
├── iniciar_painel.bat        # Execução local (Windows)
├── server.ps1                # Servidor local em PowerShell
├── versao_anterior/          # Painel v1 (edificações médias × impacto), preservado
├── CHANGELOG.md
└── README.md
```

A versão anterior continua publicada em: https://joseirley.github.io/analise_urbanistica_integrada/versao_anterior/

---

## Dados

| Camada | Arquivo | Registros | Geometria | SRC |
|---|---|---|---|---|
| Empreendimentos de impacto | `base/empreendimento_impacto_estudo_2.geojson` | 29 | MultiPoint | EPSG:31983 |
| Edificações comuns | `base/edificacoes_2.geojson` | 3.345 | MultiPoint | EPSG:31983 |
| Regionais | `base/regional.geojson` | 10 (inclui Hipercentro) | Polygon | EPSG:31983 |

O SRC é lido de cada arquivo. As camadas são reprojetadas para WGS 84 apenas para exibição; o kernel usa as coordenadas UTM originais, em metros. O mapeamento completo de campos está em [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

**Para atualizar os dados:** substitua os três arquivos em `base/` mantendo os mesmos nomes e campos, e ajuste `referenciaDados` em `js/config.js`.

---

## Qualidade e validação

- Um script **independente em Python** (`tests/referencia_python.py`) recalcula 22 cenários de filtro direto dos GeoJSON. O motor do painel reproduz os mesmos registros e as mesmas somas: **310/310 verificações**.
- **60 testes de interface** no navegador (Playwright) percorrem a introdução e clicam em gráficos, filtros, mapa, kernel, mapa de fundo e relatório PDF.
- A cada interação, o painel reconta o universo filtrado e confere indicadores, pontos do mapa, gráficos, comparativo e kernel. As divergências aparecem no console do navegador (F12).

Detalhes em [tests/RESULTADO_TESTES.md](tests/RESULTADO_TESTES.md).

---

## Tecnologias e licenças de terceiros

| Biblioteca | Uso | Licença |
|---|---|---|
| [Leaflet](https://leafletjs.com) 1.9.4 | Mapa | BSD-2-Clause |
| [Chart.js](https://www.chartjs.org) 4.4.2 | Gráficos | MIT |
| [Proj4js](http://proj4js.org) | Reprojeção | MIT |
| [pdf-lib](https://pdf-lib.js.org) 1.17.1 | Relatório PDF | MIT (`lib/pdf-lib.LICENSE.md`) |

Mapas de fundo: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; imagem de satélite © Esri, Maxar, Earthstar Geographics.
