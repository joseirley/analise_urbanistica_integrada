# Metodologia e dicionário de dados

Este documento descreve como o painel lê, trata e agrega os dados. Os arquivos de origem **não são alterados**: todo tratamento é feito em memória, no navegador.

## 1. Bases e sistema de referência

| Camada | Arquivo | Registros | SRC |
|---|---|---|---|
| Empreendimentos de impacto | `base/empreendimento_impacto_estudo_2.geojson` | 29 | SIRGAS 2000 / UTM 23S (EPSG:31983) |
| Edificações comuns | `base/edificacoes_2.geojson` | 3.345 | EPSG:31983 |
| Regionais | `base/regional.geojson` | 10 | EPSG:31983 |

**Abrangência temporal.** As edificações comuns foram aprovadas de acordo com a Lei nº 11.181/2019 (Plano Diretor), em vigor desde 5 de fevereiro de 2020. Os empreendimentos de impacto correspondem a PLUs emitidos a partir de 2020 (2020 a 2026 nesta base) e, por direito de protocolo, podem incluir empreendimentos que iniciaram o licenciamento sob a Lei nº 9.959/2010.

O SRC é lido do próprio GeoJSON (`crs.properties.name`). As geometrias são reprojetadas para WGS 84 (Proj4js) apenas para exibição no mapa. Todos os 3.374 pontos caem dentro do polígono da regional informada no atributo `nome_regional` (verificado ponto a ponto).

## 2. Dicionário de dados (campos reais × painel)

| Painel | Edificações comuns | Empreendimentos de impacto | Observação |
|---|---|---|---|
| Identificador | `_uid_` / `id_req` | `id` | |
| Nome | — | `empreendimento` | A camada de edificações não tem nome |
| Regional | `nome_regional` | `nome_regional` | |
| Bairro | `bairro` | `bairro` | |
| Unidades residenciais | `num_und_residenciais` | `und_residenciais` | Ausente ou nulo em 15 empreendimentos não residenciais |
| Vagas | `total_vagas` | `vagas_carros` | |
| Área construída (m²) | `area_construida` | `ares_construida` | Grafia original do campo |
| População estimada | `pop_estimada` | `pop_estimada` | Unidades × população média por domicílio do setor censitário (IBGE 2022); texto nos empreendimentos, convertido para número |
| Uso | `uso_projeto` | `uso` | Uniformizado (ver 3.1) |
| Enquadramento | — | `enquadramento` | Uniformizado (ver 3.2) |
| Situação do alvará | `situacao_alvara` | — | Resumida no quadro do ponto |
| Ano do PLU | — | `ano_plu` | Exibido no quadro do ponto |

## 3. Tratamentos

### 3.1 Uso
`RESIDENCIAL`/`Residencial` → **Residencial**; `Não residencial` → **Não residencial**; `MISTO`/`Misto` → **Misto**. A comparação ignora acentos, caixa e espaços extras.

### 3.2 Enquadramento
O campo combina critérios separados por "/" e tem grafias variadas. Cada critério é associado a uma categoria única. A barra de datas e leis (ex.: "Lei 11.181/2019") não conta como separador. Um empreendimento pode ter mais de um enquadramento.

| Categoria |
|---|
| Edificação com mais de 20.000 m² de área total edificada |
| Edificação com área de estacionamento > 10.000 m² ou mais de 400 vagas |
| Edificação com mais de 300 unidades habitacionais |
| Serviço de uso coletivo com área > 6.000 m² |
| Hipermercado |
| Parcelamento vinculado (lote > 10.000 m² ou quarteirão > 200 m) |
| Casa de shows e espetáculos |
| Gestão de instalações de esportes |

### 3.3 População estimada
A população estimada é calculada a partir da **população média por domicílio do setor censitário do IBGE (Censo Demográfico 2022)** em que a edificação está: número de unidades residenciais × população média por domicílio particular ocupado do setor (campo `pop_media_domicilio_particular_ocupado`), arredondado. Nas edificações comuns, o valor confere com esse cálculo em 3.344 dos 3.345 registros. Nos empreendimentos de impacto, o valor vem informado na base de estudo, em texto, e é convertido para número. É uma aproximação, não uma contagem de moradores.

### 3.4 Valores não informados
São exibidos como "Não informado". Nas somas contam como zero; nas médias por registro, entram só os registros com valor informado. Com um filtro numérico (mín./máx.) ativo, registros sem o valor ficam de fora.

### 3.5 Bairros em mais de uma regional
Dez bairros aparecem em duas regionais (ex.: Lourdes e Barro Preto — Centro-Sul/Hipercentro; Santa Efigênia e Floresta — Centro-Sul/Leste). Na comparação de um empreendimento com o seu bairro, considera-se o **bairro inteiro**.

## 4. Regras de negócio

| Regra | Definição |
|---|---|
| Edificação média | Edificação comum com `vagas` entre 100 e 400 **OU** `unidades` entre 96 e 300 **OU** `área` entre 6.000 e 20.000 m² (limites inclusivos). Na base de novembro/2026: 177 |
| Combinação de filtros | **E** entre dimensões diferentes; **OU** entre categorias da mesma dimensão |
| Enquadramento | Filtra apenas os empreendimentos de impacto |
| Filtro "Edificações Médias" | Filtra apenas as edificações comuns |
| Empreendimento selecionado | Impacto = somente o selecionado; comuns = todas do mesmo bairro. Os filtros de Regional e Bairro ficam suspensos para as comuns; os demais filtros continuam valendo |
| Gráficos (filtragem cruzada) | Cada gráfico usa todos os filtros, exceto o da própria dimensão. A categoria selecionada fica destacada e as demais, esmaecidas |
| Camadas, opacidade e mapa de fundo | Apenas visuais: não alteram filtros nem estatísticas |

### Faixas de classe (alinhadas aos limiares)

| Variável | Faixas |
|---|---|
| Unidades residenciais | 0–10 · 11–50 · 51–95 · **96–300** · > 300 |
| Vagas | 0 · 1–49 · 50–99 · **100–400** · > 400 |
| Área construída (m²) | < 1.000 · 1.000 a < 3.000 · 3.000 a < 6.000 · **6.000–20.000** · > 20.000 |
| População estimada | 0–50 · 51–200 · 201–500 · 501–1.000 · > 1.000 |

Nos gráficos de distribuição, o eixo vertical mostra a **soma do próprio dado** em cada faixa, separada em três grupos exclusivos: comuns (exceto médias), médias e impacto. Todos usam o mesmo eixo.

## 5. Densidade de edificações (kernel)

- Kernel quártico (biweight), o mesmo padrão do QGIS: `K(d) = 3/(π r²) · (1 − d²/r²)²` para `d < r`.
- Resultado em **edificações por km²**. A integral da superfície é igual ao número de edificações (conservação de massa, verificada nos testes).
- O raio vai de 200 a 3.000 m. As distâncias são calculadas em metros, nas coordenadas UTM (EPSG:31983) de cada pixel, numa grade alinhada ao mapa.
- A densidade usa as **edificações comuns filtradas**. As superfícies ficam em cache por (raio, conjunto de pontos), e nada é recalculado com a camada desligada.

## 6. Relatório PDF

O relatório é gerado no navegador (pdf-lib), a partir do mesmo estado de filtros e do mesmo motor de cálculo da tela. Contém:
1. filtros aplicados;
2. indicadores;
3. imagem do mapa, com legenda e explicação;
4. tabela comparativa, com texto interpretativo e a comparação do empreendimento com o bairro, se houver;
5. gráficos, cada um com uma explicação;
6. notas metodológicas.

O mapa de fundo é incluído quando o servidor de mapas permite a cópia da imagem.

## 7. Validação

| Nível | Como |
|---|---|
| Referência independente | `tests/referencia_python.py` recalcula 22 cenários em Python puro, sem usar o código do painel. `tests/teste_motor.js` compara: mesmos registros (hash dos identificadores), mesmas somas, mesmos gráficos e percentuais — 310 verificações |
| Interface | `tests/teste_interface.py` (Playwright + Chrome): 60 testes com cliques reais, partindo da página de introdução, incluindo a geração e a conferência do conteúdo do PDF |
| Tempo de execução | `js/validation.js` confere, a cada interação, indicadores × registros, mapa × filtro, gráficos × universo, comparativo e kernel. As divergências são registradas no console |
