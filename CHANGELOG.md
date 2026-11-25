# Histórico de versões

## 2.0 — novembro/2026

Nova versão do painel, agora comparando **edificações comuns** com **empreendimentos de impacto**. A versão 1.0 foi preservada em [`versao_anterior/`](versao_anterior/).

### Dados
- Novas bases: `edificacoes_2.geojson` (3.345 edificações comuns), `empreendimento_impacto_estudo_2.geojson` (29 empreendimentos) e `regional.geojson` (10 regionais, com a Hipercentro), todas em EPSG:31983.
- O SRC é lido do próprio arquivo e o mapeamento dos campos reais está documentado.
- Uso e enquadramento uniformizados, sem alterar os arquivos de origem.
- Data de referência dos dados (novembro/2026) exibida no painel e no relatório.

### Novas funcionalidades
- **Página de introdução** como entrada do relatório (objetivo, contexto, bases, tratamento dos dados, filtros, como ler e cuidados), com o botão **Ir para o relatório** e, no relatório, o botão **← Introdução**.
- Filtro especial **Edificações Médias** (vagas 100–400 OU unidades 96–300 OU área 6.000–20.000 m²).
- Seleção de empreendimento de impacto com filtragem automática das edificações comuns do mesmo bairro.
- Comparativo **comuns × médias × impacto**: totais, média por registro e participação.
- Gráficos com **filtragem cruzada** no estilo do Power BI, com estado global único de filtros.
- Distribuições por faixa com a soma do próprio dado, para comuns, médias e impacto, em eixo único.
- **Densidade kernel** própria, com raio em metros (200 a 3.000 m) calculado em UTM, e cache.
- Seletor de mapa de fundo **Street/Satellite**.
- Filtros em listas suspensas com seleção múltipla e contagens; faixas numéricas (mín./máx.).
- Quadro do ponto com navegação entre registros no mesmo local.
- **Relatório PDF** com os dados em tela.
- Etiquetas de filtros ativos e botão **Limpar filtros**.

### Qualidade
- Validação independente em Python (22 cenários, 310 verificações), 60 testes de interface e verificações de consistência a cada interação.

### Organização do repositório
- Painel v2 na raiz (publicado no GitHub Pages); v1 movido para `versao_anterior/`.
- Documentação: `README.md`, `docs/GUIA_DE_USO.md`, `docs/METODOLOGIA.md` e `CHANGELOG.md`.

## 1.0

Painel de análise integrada entre edificações médias e empreendimentos de impacto (`versao_anterior/`).
