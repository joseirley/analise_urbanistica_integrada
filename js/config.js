/**
 * config.js
 * Configuração central: arquivos, mapeamento dos campos REAIS de cada camada,
 * limiares de "Edificações Médias", faixas de classe, cores e mapas de fundo.
 *
 * Os nomes de campo abaixo foram levantados por inspeção direta dos GeoJSON
 * (ver README.md > "Mapeamento de atributos"). Não há atributos inventados.
 */
(function (root) {
  'use strict';

  const CONFIG = {
    // Data de referência dos dados (exibida no cabeçalho, rodapé e relatório PDF)
    referenciaDados: 'novembro/2026',

    arquivos: {
      impacto: 'base/empreendimento_impacto_estudo_2.geojson',
      edificacoes: 'base/edificacoes_2.geojson',
      regional: 'base/regional.geojson'
    },

    // SIRGAS 2000 / UTM 23S — SRC nativo dos pontos (urn:ogc:def:crs:EPSG::31983).
    // Usado para cálculo do KDE em metros.
    epsgUTM: 'EPSG:31983',
    proj4UTM: '+proj=utm +zone=23 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',

    // Mapeamento campo real -> atributo canônico do painel
    campos: {
      edificacoes: {
        uid: '_uid_',
        id: 'id_req',
        nome: null,                       // camada não possui nome de empreendimento
        regional: 'nome_regional',
        bairro: 'bairro',
        und: 'num_und_residenciais',
        vagas: 'total_vagas',
        area: 'area_construida',
        pop: 'pop_estimada',
        uso: 'uso_projeto',
        enquadramento: null,
        extras: { titulo: 'titulo_projeto', situacao: 'situacao_alvara' }
      },
      impacto: {
        uid: 'id',
        id: 'id',
        nome: 'empreendimento',
        regional: 'nome_regional',
        bairro: 'bairro',
        und: 'und_residenciais',          // ausente/nulo para usos não residenciais
        vagas: 'vagas_carros',
        area: 'ares_construida',          // grafia original do campo
        pop: 'pop_estimada',              // armazenado como texto na origem
        uso: 'uso',
        enquadramento: 'enquadramento',
        extras: { ano: 'ano_plu', zoneamento: 'zoneamento', processo: 'num_olei', observacao: 'observacao' }
      },
      regional: { nome: 'nome_regional', sigla: 'sigla' }
    },

    // Regra "Edificações Médias – Próximas aos limiares de impacto" (OR, limites inclusivos)
    limiaresMedias: [
      { campo: 'vagas', min: 100, max: 400, rotulo: 'Vagas entre 100 e 400' },
      { campo: 'und', min: 96, max: 300, rotulo: 'Unidades residenciais entre 96 e 300' },
      { campo: 'area', min: 6000, max: 20000, rotulo: 'Área construída entre 6.000 e 20.000 m²' }
    ],

    // Faixas de classe (alinhadas aos limiares de impacto). Cada valor cai em exatamente uma faixa.
    faixas: {
      und: [
        { k: 'ni', rotulo: 'Não informado', teste: v => v === null },
        { k: 'a', rotulo: '0–10', teste: v => v !== null && v <= 10 },
        { k: 'b', rotulo: '11–50', teste: v => v !== null && v > 10 && v <= 50 },
        { k: 'c', rotulo: '51–95', teste: v => v !== null && v > 50 && v < 96 },
        { k: 'd', rotulo: '96–300', teste: v => v !== null && v >= 96 && v <= 300 },
        { k: 'e', rotulo: '> 300', teste: v => v !== null && v > 300 }
      ],
      vagas: [
        { k: 'ni', rotulo: 'Não informado', teste: v => v === null },
        { k: 'a', rotulo: '0', teste: v => v !== null && v === 0 },
        { k: 'b', rotulo: '1–49', teste: v => v !== null && v > 0 && v < 50 },
        { k: 'c', rotulo: '50–99', teste: v => v !== null && v >= 50 && v < 100 },
        { k: 'd', rotulo: '100–400', teste: v => v !== null && v >= 100 && v <= 400 },
        { k: 'e', rotulo: '> 400', teste: v => v !== null && v > 400 }
      ],
      area: [
        { k: 'ni', rotulo: 'Não informado', teste: v => v === null },
        { k: 'a', rotulo: '< 1.000 m²', teste: v => v !== null && v < 1000 },
        { k: 'b', rotulo: '1.000 a < 3.000', teste: v => v !== null && v >= 1000 && v < 3000 },
        { k: 'c', rotulo: '3.000 a < 6.000', teste: v => v !== null && v >= 3000 && v < 6000 },
        { k: 'd', rotulo: '6.000–20.000', teste: v => v !== null && v >= 6000 && v <= 20000 },
        { k: 'e', rotulo: '> 20.000 m²', teste: v => v !== null && v > 20000 }
      ],
      pop: [
        { k: 'ni', rotulo: 'Não informado', teste: v => v === null },
        { k: 'a', rotulo: '0–50', teste: v => v !== null && v <= 50 },
        { k: 'b', rotulo: '51–200', teste: v => v !== null && v > 50 && v <= 200 },
        { k: 'c', rotulo: '201–500', teste: v => v !== null && v > 200 && v <= 500 },
        { k: 'd', rotulo: '501–1.000', teste: v => v !== null && v > 500 && v <= 1000 },
        { k: 'e', rotulo: '> 1.000', teste: v => v !== null && v > 1000 }
      ]
    },

    usos: ['Residencial', 'Não residencial', 'Misto'],

    grupos: [
      { k: 'comum_demais', rotulo: 'Edificações comuns (exceto médias)' },
      { k: 'media', rotulo: 'Edificações médias' },
      { k: 'impacto', rotulo: 'Empreendimentos de impacto' }
    ],

    variaveis: {
      und: { rotulo: 'Unidades residenciais', unidade: 'un.', casas: 0 },
      vagas: { rotulo: 'Vagas', unidade: 'vagas', casas: 0 },
      area: { rotulo: 'Área construída', unidade: 'm²', casas: 2 },
      pop: { rotulo: 'População estimada', unidade: 'hab.', casas: 0 }
    },

    cores: {
      comum: '#2563eb',
      media: '#f59e0b',
      impacto: '#dc2626',
      regional: '#0f2d59',
      contexto: '#94a3b8',
      contornoComum: '#0b1f3a',   // contorno das edificações comuns
      contornoMedia: '#5c1d06'    // contorno das edificações médias
    },

    // KDE (raio em metros, kernel quártico — mesmo kernel padrão do QGIS)
    kde: { raioPadrao: 800, raioMin: 200, raioMax: 3000, passo: 100 },

    mapa: {
      centro: [-19.9208, -43.9378],
      zoom: 12,
      fundos: {
        street: {
          rotulo: 'Street',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          opcoes: {
            maxZoom: 19, crossOrigin: true,   // permite incluir o mapa de fundo no relatório PDF
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
          }
        },
        satellite: {
          rotulo: 'Satellite',
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          opcoes: {
            maxZoom: 19, crossOrigin: true,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community; ' +
              'vias: Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
          },
          // Camadas sobrepostas à imagem: vias e nomes das vias (fundo transparente)
          sobreposicoes: [
            { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
              opcoes: { maxZoom: 19, crossOrigin: true } }
          ]
        }
      }
    }
  };

  root.CONFIG = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
