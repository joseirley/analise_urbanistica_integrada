/**
 * data-service.js
 * Módulo de carregamento e manipulação de dados dos GeoJSONs
 * DALU / Suplan - Prefeitura de Belo Horizonte
 */

class DataService {
  constructor() {
    this.rawEdificacoesMediasEstudo = null;
    this.rawEmpreendimentoImpactoEstudo = null;
    this.rawEdificacoesMediasGeral = null;
    this.rawRegional = null;

    this.filteredMedias = [];
    this.filteredImpacto = [];

    // Definição da projeção SIRGAS 2000 / UTM zone 23S (EPSG:31983)
    if (typeof proj4 !== 'undefined') {
      proj4.defs("EPSG:31983", "+proj=utm +zone=23 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
    }
  }

  // Normalização e uniformização de textos de enquadramento
  static normalizeEnquadramento(str) {
    if (!str) return '';
    let norm = str.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

    // Uniformizar variações com e sem espaço em 10.000 M² / 10.000M² e DEZ MIL METROS QUADRADOS
    const padraoEstacionamento = /EDIFICAÇÕES COM ÁREA DE ESTACIONAMENTO MAIOR QUE 10\.?000\s*M².*?(OU COM MAIS DE 400 \(QUATROCENTAS\) VAGAS|OU COM MAIS DE 400 VAGAS)/i;
    if (padraoEstacionamento.test(norm)) {
      return "EDIFICAÇÕES COM ÁREA DE ESTACIONAMENTO MAIOR QUE 10.000 M² (DEZ MIL METROS QUADRADOS) OU COM MAIS DE 400 (QUATROCENTAS) VAGAS";
    }

    if (norm.toUpperCase().includes("EDIFICAÇÕES COM MAIS DE 20.000") || norm.toUpperCase().includes("EDIFICAÇÕES COM MAIS DE 20.000 M²")) {
      return "EDIFICAÇÕES COM MAIS DE 20.000 M² (VINTE MIL METROS QUADRADOS) DE ÁREA TOTAL EDIFICADA";
    }

    if (norm.toUpperCase().includes("EDIFICAÇÕES COM MAIS DE 300") || norm.toUpperCase().includes("300 (TREZENTAS) UNIDADES")) {
      return "EDIFICAÇÕES COM MAIS DE 300 (TREZENTAS) UNIDADES HABITACIONAIS";
    }

    return norm;
  }

  async loadData() {
    try {
      const fetchJson = async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ao carregar ${url}`);
          }
          return await res.json();
        } catch (fetchErr) {
          if (window.location.protocol === 'file:') {
            throw new Error(
              `O navegador bloqueia o carregamento direto de arquivos locais por segurança (protocolo file://). Por gentileza, execute o arquivo "iniciar_painel.bat" para abrir o painel pelo servidor local em http://localhost:8080/.`
            );
          }
          throw fetchErr;
        }
      };

      // Carrega os dados principais (pontos)
      const [mediasEstudo, impactoEstudo] = await Promise.all([
        fetchJson('base/json/edificacoes_medias_estudo.geojson'),
        fetchJson('base/json/empreendimento_impacto_estudo.geojson')
      ]);

      this.rawEdificacoesMediasEstudo = mediasEstudo;
      this.rawEmpreendimentoImpactoEstudo = impactoEstudo;
      this.rawEdificacoesMediasGeral = { type: 'FeatureCollection', features: [] };

      // Carrega regional_1.geojson separadamente
      try {
        this.rawRegional = await fetchJson('base/json/regional_1.geojson');
      } catch (regErr) {
        console.warn('Aviso: não foi possível carregar regional_1.geojson.', regErr);
        this.rawRegional = { type: 'FeatureCollection', features: [] };
      }

      this.processRawData();

      return {
        mediasEstudo: this.rawEdificacoesMediasEstudo,
        impactoEstudo: this.rawEmpreendimentoImpactoEstudo,
        regional: this.rawRegional
      };
    } catch (err) {
      console.error('Erro ao carregar dados GeoJSON:', err);
      throw err;
    }
  }

  processRawData() {
    // Helper para converter coordenadas se estiverem em UTM
    const normalizeFeatureCoords = (f) => {
      if (!f.geometry || !f.geometry.coordinates) return;
      const isMulti = f.geometry.type === 'MultiPoint' || (Array.isArray(f.geometry.coordinates) && Array.isArray(f.geometry.coordinates[0]));
      const pt = isMulti ? f.geometry.coordinates[0] : f.geometry.coordinates;
      if (!Array.isArray(pt) || pt.length < 2) return;
      const [x, y] = pt;

      if (Math.abs(x) > 100000 && typeof proj4 !== 'undefined') {
        const [lng, lat] = proj4("EPSG:31983", "EPSG:4326", [x, y]);
        f.geometry.coordinates = isMulti ? [[lng, lat]] : [lng, lat];
      }
    };

    // 1. Processar Edificações Médias (Estudo) - Pontos Vetoriais
    if (this.rawEdificacoesMediasEstudo && this.rawEdificacoesMediasEstudo.features) {
      this.rawEdificacoesMediasEstudo.features.forEach(f => {
        normalizeFeatureCoords(f);

        const p = f.properties;
        p.id_req = p.id_req || 'N/I';
        p.total_vagas = Number(p.total_vagas) || 0;
        p.num_und_residenciais = Number(p.num_und_residenciais) || 0;
        p.area_construida = Number(p.area_construida) || 0;
        p.pop_estimada = Number(p.pop_estimada) || 0;
        p.nome_regional = (p.nome_regional || 'NÃO INFORMADO').trim().toUpperCase();
        p.bairro = (p.bairro || 'NÃO INFORMADO').trim();
        p.situacao_alvara = 'Ativo';
        p.titulo_projeto = p.titulo_projeto || 'NÃO INFORMADO';
        p.uso_projeto = p.uso_projeto || 'NÃO INFORMADO';
      });
    }

    // 2. Processar Empreendimentos de Impacto (Estudo) - Pontos Vetoriais
    if (this.rawEmpreendimentoImpactoEstudo && this.rawEmpreendimentoImpactoEstudo.features) {
      this.rawEmpreendimentoImpactoEstudo.features.forEach(f => {
        normalizeFeatureCoords(f);

        const p = f.properties;
        p.id = p.id || 'N/I';
        p.empreendimento = (p.empreendimento || 'NÃO INFORMADO').trim();
        p.ano_plu = p.ano_plu ? Number(p.ano_plu) : 'N/I';
        p.nome_regional = (p.nome_regional || 'NÃO INFORMADO').trim().toUpperCase();
        p.bairro = (p.bairro || 'NÃO INFORMADO').trim();
        p.num_und_residencial = Number(p.num_und_residencial) || 0;
        p.total_vagas = Number(p.total_vagas) || 0;
        p.pop_estimada = Number(p.pop_estimada) || 0;

        // Normalização das categorias de enquadramento
        p.enquadramento_lista = [];
        if (p.enquadramento) {
          const rawItems = p.enquadramento.split('/');
          rawItems.forEach(item => {
            const trimmed = item.trim();
            // Ignorar categorias que citam parcelamento
            if (trimmed.toUpperCase().includes("PARCELAMENTO")) {
              return;
            }
            const norm = DataService.normalizeEnquadramento(trimmed);
            if (norm.length > 5 && !p.enquadramento_lista.includes(norm)) {
              p.enquadramento_lista.push(norm);
            }
          });
        }
      });
    }

    // 3. Processar Edificações Médias (Geral) para Kernel
    if (this.rawEdificacoesMediasGeral && this.rawEdificacoesMediasGeral.features) {
      this.rawEdificacoesMediasGeral.features.forEach(f => {
        if (!f.geometry || !f.geometry.coordinates) return;
        const isMulti = f.geometry.type === 'MultiPoint' || (Array.isArray(f.geometry.coordinates) && Array.isArray(f.geometry.coordinates[0]));
        const pt = isMulti ? f.geometry.coordinates[0] : f.geometry.coordinates;
        if (!Array.isArray(pt) || pt.length < 2) return;
        const [x, y] = pt;

        if (Math.abs(x) > 100000 && typeof proj4 !== 'undefined') {
          const [lng, lat] = proj4("EPSG:31983", "EPSG:4326", [x, y]);
          f.geometry.coordinates = isMulti ? [[lng, lat]] : [lng, lat];
          f.wgs84Coords = [lat, lng];
        } else {
          f.wgs84Coords = [y, x]; // [lat, lng]
        }
      });
    }

    // 4. Processar Regional (regional_1.geojson — campos: ID_REGIONAL, NOME_REGIONAL, coordenadas UTM)
    if (this.rawRegional && this.rawRegional.features) {
      const needsReproject = (() => {
        const f = this.rawRegional.features.find(ft => ft.geometry && ft.geometry.coordinates && ft.geometry.coordinates.length > 0);
        if (!f) return false;
        try {
          const geom = f.geometry;
          let c = null;
          if (geom.type === 'Polygon') c = geom.coordinates[0][0];
          else if (geom.type === 'MultiPolygon') c = geom.coordinates[0][0][0];
          return c && Math.abs(c[0]) > 100000;
        } catch (e) { return false; }
      })();

      const reprojectRing = (ring) => ring.map(coord => {
        if (typeof proj4 === 'undefined') return coord;
        const [lng, lat] = proj4('EPSG:31983', 'EPSG:4326', [coord[0], coord[1]]);
        return [lng, lat];
      });

      this.rawRegional.features.forEach(f => {
        const p = f.properties;
        // Normalizar campos de atributo
        if (p.ID_REGIONAL !== undefined) p.id_regional = p.ID_REGIONAL;
        if (p.NOME_REGIONAL !== undefined) {
          p.nome_regional = (p.NOME_REGIONAL || '').trim().toUpperCase();
        } else {
          p.nome_regional = (p.nome_regional || '').trim().toUpperCase();
        }

        // Reprojetar coordenadas UTM → WGS84 diretamente na feature (in-place)
        if (needsReproject && f.geometry && typeof proj4 !== 'undefined') {
          const geom = f.geometry;
          if (geom.type === 'Polygon') {
            geom.coordinates = geom.coordinates.map(reprojectRing);
          } else if (geom.type === 'MultiPolygon') {
            geom.coordinates = geom.coordinates.map(poly => poly.map(reprojectRing));
          }
        }
      });
    }
  }

  getDistinctValues() {
    const regionais = new Set();
    const bairros = new Set();
    const empreendimentos = new Set();
    const enquadramentos = new Set();

    // Edificações médias (estudo)
    this.rawEdificacoesMediasEstudo.features.forEach(f => {
      const p = f.properties;
      if (p.nome_regional) regionais.add(p.nome_regional);
      if (p.bairro) bairros.add(p.bairro);
    });

    // Empreendimentos de impacto (estudo)
    this.rawEmpreendimentoImpactoEstudo.features.forEach(f => {
      const p = f.properties;
      if (p.nome_regional) regionais.add(p.nome_regional);
      if (p.bairro) bairros.add(p.bairro);
      if (p.empreendimento && p.empreendimento !== 'NÃO INFORMADO') empreendimentos.add(p.empreendimento);

      if (p.enquadramento_lista) {
        p.enquadramento_lista.forEach(enq => enquadramentos.add(enq));
      }
    });

    return {
      regionais: Array.from(regionais).sort(),
      bairros: Array.from(bairros).sort(),
      empreendimentos: Array.from(empreendimentos).sort(),
      enquadramentos: Array.from(enquadramentos).sort()
    };
  }

  filterData(filters) {
    const {
      regional,
      bairro,
      empreendimento,
      enquadramento
    } = filters;

    // 1. Filtra Empreendimentos de Impacto Estudo primeiro para saber quais bairros/regionais estão em foco
    this.filteredImpacto = this.rawEmpreendimentoImpactoEstudo.features.filter(f => {
      const p = f.properties;

      if (regional && regional !== 'TODAS' && p.nome_regional !== regional) return false;
      if (bairro && bairro !== 'TODOS' && p.bairro !== bairro) return false;

      if (empreendimento && empreendimento !== 'TODOS' && p.empreendimento !== empreendimento) return false;

      if (enquadramento && enquadramento !== 'TODOS') {
        if (!p.enquadramento_lista || !p.enquadramento_lista.includes(enquadramento)) return false;
      }

      return true;
    });

    // Bairros e regionais dos empreendimentos de impacto selecionados (caso haja filtro de empreendimento ou enquadramento)
    const bairrosImpactoFoco = new Set(this.filteredImpacto.map(f => f.properties.bairro).filter(Boolean));
    const regionaisImpactoFoco = new Set(this.filteredImpacto.map(f => f.properties.nome_regional).filter(Boolean));

    const temFiltroEspecificoImpacto = (empreendimento && empreendimento !== 'TODOS') || (enquadramento && enquadramento !== 'TODOS');

    // 2. Filtra Edificações Médias Estudo
    // Se o usuário selecionou um empreendimento ou enquadramento, mantemos as edificações médias que estão no mesmo bairro
    // (ou na mesma regional se o bairro for amplo) para permitir a comparação urbana direta
    this.filteredMedias = this.rawEdificacoesMediasEstudo.features.filter(f => {
      const p = f.properties;

      if (regional && regional !== 'TODAS' && p.nome_regional !== regional) return false;
      if (bairro && bairro !== 'TODOS' && p.bairro !== bairro) return false;

      if (temFiltroEspecificoImpacto) {
        // Se há empreendimento ou enquadramento selecionado, inclui apenas as edificações médias do(s) mesmo(s) bairro(s)
        if (bairrosImpactoFoco.size > 0 && !bairrosImpactoFoco.has(p.bairro)) {
          return false;
        }
      }

      return true;
    });

    return {
      medias: this.filteredMedias,
      impacto: this.filteredImpacto
    };
  }

  computeKPIs(medias, impacto) {
    let totalVagas = 0;
    let totalArea = 0;
    let totalUnidades = 0;
    let totalPopEstimada = 0;

    medias.forEach(f => {
      const p = f.properties;
      totalVagas += p.total_vagas || 0;
      totalArea += p.area_construida || 0;
      totalUnidades += p.num_und_residenciais || 0;
      totalPopEstimada += p.pop_estimada || 0;
    });

    impacto.forEach(f => {
      const p = f.properties;
      totalVagas += p.total_vagas || 0;
      totalUnidades += p.num_und_residencial || 0;
      totalPopEstimada += p.pop_estimada || 0;
    });

    return {
      countMedias: medias.length,
      countImpacto: impacto.length,
      totalProjetos: medias.length + impacto.length,
      totalVagas,
      totalUnidades,
      totalArea,
      totalPopEstimada
    };
  }
}

window.dataService = new DataService();
