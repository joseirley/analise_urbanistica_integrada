> **Versão anterior (1.0).** Este painel foi substituído pela versão 2.0, publicada na raiz do repositório:
> https://joseirley.github.io/analise_urbanistica_integrada/ — ver [README principal](../README.md) e [CHANGELOG](../CHANGELOG.md).
> Esta versão continua acessível em https://joseirley.github.io/analise_urbanistica_integrada/versao_anterior/

# Painel de Análise Urbanística Integrada (PBH)

Painel interativo para análise urbanística integrada entre **Edificações Médias** e **Empreendimentos de Impacto Urbano** no município de Belo Horizonte.

- **Órgão Responsável:** Diretoria de Análise de Licenciamentos Urbanísticos Especiais (DALU) / Subsecretaria de Planejamento Urbano (Suplan)
- **Base Legal:** Art. 345 da Lei Municipal nº 11.181/2019 (Plano Diretor de Belo Horizonte)
- **Fonte dos Dados:** Banco de Dados Suplan (2020–2026) e Censo Demográfico IBGE (2022)

---

## 🚀 Como Executar

### Pré-requisito
- Sistema Operacional Windows com PowerShell (padrão no Windows 10/11).
- Não requer instalação de Node.js, Python ou servidores adicionais. Todas as dependências (Leaflet, Chart.js, Proj4) estão incluídas localmente na pasta `lib/`.

### Inicialização Rápida
1. Dê um duplo clique no arquivo **`iniciar_painel.bat`**.
2. O servidor local será iniciado e a página abrirá automaticamente no navegador padrão em `http://localhost:8080/`.

---

## 🗺️ Funcionalidades

- **Mapa Interativo (Leaflet):**
  - Camada vetorial de Limites das Regionais (`regional_1.geojson`);
  - Camada de pontos das Edificações Médias do Estudo (`edificacoes_medias_estudo.geojson`);
  - Camada de pontos dos Empreendimentos de Impacto do Estudo (`empreendimento_impacto_estudo.geojson`);
  - Mapa de calor de Kernel: *Densidade de Projeto de Edificações - Geral* (`edificacoes_medias_estudo_geral.geojson`);
  - Controles de visibilidade (ligar/desligar) e controles individuais de opacidade para cada camada;
  - Zoom interativo conforme seleção de filtros e cliques nos elementos do mapa.
- **Filtros Dinâmicos:**
  - Regional;
  - Bairro (atualizado dinamicamente com base na regional selecionada);
  - Empreendimento de Impacto (por nome);
  - Enquadramento legal (Impacto).
- **Indicadores Urbanísticos (KPIs):**
  - Total de Projetos (Edificações Médias + Empreendimentos de Impacto);
  - Quantidade de Vagas de Garagem geradas;
  - Unidades Residenciais geradas;
  - População Estimada gerada;
  - Área Construída total (m²).
- **Gráficos Integrados (Chart.js):**
  - Concentração por Bairro (Médias vs. Impacto);
  - Comparativo de Vagas de Estacionamento;
  - Comparativo de Unidades Habitacionais;
  - Comparativo de População Estimada.

---

## 📁 Estrutura de Arquivos

```
painel/
├── base/
│   ├── json/             # Bases GeoJSON (WGS84 / EPSG:31983 com reprojeção automática)
│   └── logo/             # Logotipo institucional da PBH
├── css/
│   └── styles.css        # Folha de estilos responsiva do painel
├── js/
│   ├── app.js            # Orquestração da interface, filtros e eventos
│   ├── data-service.js   # Carregamento, normalização de atributos e projeções
│   ├── map.js            # Gerenciamento do mapa Leaflet, camadas e heatmap
│   └── charts.js         # Gerenciamento dos gráficos comparativos
├── lib/                  # Bibliotecas JavaScript e CSS locais (offline)
├── index.html            # Estrutura principal da página
├── iniciar_painel.bat    # Script de inicialização no Windows
├── server.ps1            # Servidor HTTP local em PowerShell
└── README.md             # Documentação do projeto
```
