/**
 * data-loader.js
 * Carregamento (uma única vez), validação e montagem dos registros canônicos.
 * Os GeoJSON originais não são alterados: cada feição gera um NOVO objeto "registro".
 */
(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);
  const N = root.Normalize || (typeof require !== 'undefined' ? require('./normalize.js') : null);

  function primeiroPonto(geom) {
    if (!geom || !geom.coordinates) return null;
    if (geom.type === 'Point') return geom.coordinates;
    if (geom.type === 'MultiPoint') return geom.coordinates[0] || null;
    return null;
  }

  function crsDe(gj) {
    const n = gj && gj.crs && gj.crs.properties && gj.crs.properties.name;
    if (!n) return 'EPSG:4326';
    if (/31983/.test(n)) return 'EPSG:31983';
    if (/CRS84|4326/.test(n)) return 'EPSG:4326';
    return n;
  }

  function ehMedia(r) {
    return CONFIG.limiaresMedias.some(l => {
      const v = r[l.campo];
      return v !== null && v >= l.min && v <= l.max;
    });
  }

  function faixaDe(variavel, v) {
    const f = CONFIG.faixas[variavel].find(b => b.teste(v));
    return f ? f.k : null;
  }

  /**
   * Monta os registros a partir dos GeoJSON já lidos.
   * @param {object} proj4 biblioteca proj4 (navegador ou Node)
   */
  function montar(gjImpacto, gjEdif, gjRegional, proj4) {
    proj4.defs(CONFIG.epsgUTM, CONFIG.proj4UTM);
    const qualidade = { camadas: {}, avisos: [], enquadramentoMapa: {}, enquadramentoNaoMapeado: [] };

    function construir(gj, tipo) {
      const m = CONFIG.campos[tipo === 'impacto' ? 'impacto' : 'edificacoes'];
      const crs = crsDe(gj);
      const q = {
        arquivo: CONFIG.arquivos[tipo === 'impacto' ? 'impacto' : 'edificacoes'],
        crs, feicoes: gj.features.length, semGeometria: 0, foraDeBH: 0,
        nulos: { und: 0, vagas: 0, area: 0, pop: 0, uso: 0, bairro: 0, regional: 0 },
        negativos: { und: 0, vagas: 0, area: 0, pop: 0 },
        usoNaoReconhecido: [], tiposGeometria: {}
      };
      const regs = [];
      gj.features.forEach((f, i) => {
        const p = f.properties || {};
        const gt = f.geometry ? f.geometry.type : 'null';
        q.tiposGeometria[gt] = (q.tiposGeometria[gt] || 0) + 1;
        const pt = primeiroPonto(f.geometry);
        if (!pt) { q.semGeometria++; return; }
        let x, y, lng, lat;
        if (crs === 'EPSG:31983') {
          [x, y] = pt; [lng, lat] = proj4(CONFIG.epsgUTM, 'EPSG:4326', [x, y]);
        } else {
          [lng, lat] = pt; [x, y] = proj4('EPSG:4326', CONFIG.epsgUTM, [lng, lat]);
        }
        if (!(lat > -20.2 && lat < -19.6 && lng > -44.2 && lng < -43.7)) q.foraDeBH++;

        const r = {
          uid: (tipo === 'impacto' ? 'I:' : 'E:') + (p[m.uid] !== undefined ? p[m.uid] : i),
          tipo,
          id: p[m.id] !== undefined ? p[m.id] : null,
          nome: m.nome ? (N.limpo(p[m.nome]) || null) : null,
          regional: N.regional(p[m.regional]),
          bairro: N.limpo(p[m.bairro]) || null,
          und: N.numero(p[m.und]),
          vagas: N.numero(p[m.vagas]),
          area: N.numero(p[m.area]),
          pop: N.numero(p[m.pop]),
          uso: N.uso(p[m.uso]),
          usoOriginal: p[m.uso] !== undefined ? p[m.uso] : null,
          enq: [],
          enqOriginal: m.enquadramento ? (p[m.enquadramento] || null) : null,
          x, y, lat, lng,
          extras: {}
        };
        r.bairroKey = N.chave(r.bairro);
        Object.entries(m.extras).forEach(([k, campo]) => {
          let v = p[campo] !== undefined ? p[campo] : null;
          if (k === 'situacao') v = N.resumoSituacao(v);
          if (k === 'ano' && v !== null) v = Math.round(Number(v));
          r.extras[k] = v;
        });

        ['und', 'vagas', 'area', 'pop'].forEach(c => {
          if (r[c] === null) q.nulos[c]++;
          else if (r[c] < 0) { q.negativos[c]++; r[c] = null; } // valor inválido tratado como não informado
        });
        if (r.uso === null) { q.nulos.uso++; if (r.usoOriginal) q.usoNaoReconhecido.push(r.usoOriginal); }
        if (!r.bairro) q.nulos.bairro++;
        if (!r.regional) q.nulos.regional++;

        if (tipo === 'impacto') {
          const e = N.enquadramentos(r.enqOriginal);
          r.enq = e.lista;
          e.lista.forEach(c => { qualidade.enquadramentoMapa[c] = (qualidade.enquadramentoMapa[c] || 0) + 1; });
          e.naoMapeados.forEach(t => qualidade.enquadramentoNaoMapeado.push({ uid: r.uid, texto: t }));
          r.media = false;
          r.grupo = 'impacto';
        } else {
          r.media = ehMedia(r);
          r.grupo = r.media ? 'media' : 'comum_demais';
        }
        r.faixa = {
          und: faixaDe('und', r.und), vagas: faixaDe('vagas', r.vagas),
          area: faixaDe('area', r.area), pop: faixaDe('pop', r.pop)
        };
        regs.push(r);
      });
      qualidade.camadas[tipo] = q;
      return regs;
    }

    const impacto = construir(gjImpacto, 'impacto');
    const comuns = construir(gjEdif, 'comum');

    // Regionais: reprojeta para WGS84 se necessário (cópia, sem alterar o original)
    const crsReg = crsDe(gjRegional);
    const reproj = c => crsReg === 'EPSG:4326' ? c : proj4(CONFIG.epsgUTM, 'EPSG:4326', c);
    const regional = {
      type: 'FeatureCollection',
      features: gjRegional.features.map(f => {
        const g = f.geometry;
        let coords = g.type === 'Polygon'
          ? g.coordinates.map(r => r.map(reproj))
          : g.coordinates.map(p => p.map(r => r.map(reproj)));
        return {
          type: 'Feature',
          properties: {
            nome_regional: N.regional(f.properties[CONFIG.campos.regional.nome]),
            sigla: f.properties[CONFIG.campos.regional.sigla] || null
          },
          geometry: { type: g.type, coordinates: coords }
        };
      })
    };
    qualidade.camadas.regional = { arquivo: CONFIG.arquivos.regional, crs: crsReg, feicoes: regional.features.length };

    // ---- Validações cruzadas ----
    const nomesReg = new Set(regional.features.map(f => f.properties.nome_regional));
    [...impacto, ...comuns].forEach(r => {
      if (r.regional && !nomesReg.has(r.regional)) qualidade.avisos.push(`Regional "${r.regional}" (${r.uid}) não existe na camada de regionais.`);
    });
    const uids = new Set();
    [...impacto, ...comuns].forEach(r => {
      if (uids.has(r.uid)) qualidade.avisos.push(`Identificador duplicado: ${r.uid}`);
      uids.add(r.uid);
    });
    // Bairros presentes em mais de uma regional (limites de bairro x regional)
    const br = {};
    [...impacto, ...comuns].forEach(r => { (br[r.bairro] = br[r.bairro] || new Set()).add(r.regional); });
    qualidade.bairrosMultiRegional = Object.entries(br).filter(([, s]) => s.size > 1)
      .map(([b, s]) => ({ bairro: b, regionais: [...s].sort() }));
    // Bairros de impacto sem edificações comuns
    const bairrosComuns = new Set(comuns.map(r => r.bairroKey));
    qualidade.bairrosImpactoSemComuns = [...new Set(impacto.filter(r => !bairrosComuns.has(r.bairroKey)).map(r => r.bairro))];
    // Coordenadas coincidentes
    const coinc = {};
    comuns.forEach(r => { const k = r.x.toFixed(1) + '|' + r.y.toFixed(1); coinc[k] = (coinc[k] || 0) + 1; });
    qualidade.pontosCoincidentes = Object.values(coinc).filter(n => n > 1).reduce((a, b) => a + b, 0);
    // Edificações comuns acima de limiares de impacto (informativo)
    qualidade.comunsAcimaLimiar = {
      vagas: comuns.filter(r => r.vagas !== null && r.vagas > 400).length,
      und: comuns.filter(r => r.und !== null && r.und > 300).length,
      area: comuns.filter(r => r.area !== null && r.area > 20000).length
    };
    qualidade.totalMedias = comuns.filter(r => r.media).length;
    qualidade.camposImpactoAusentes = gjImpacto.features.filter(f => !(CONFIG.campos.impacto.und in (f.properties || {}))).length;

    return { impacto, comuns, todos: [...comuns, ...impacto], regional, qualidade };
  }

  async function carregar() {
    const buscar = async url => {
      let res;
      try { res = await fetch(url, { cache: 'no-cache' }); } catch (e) {
        if (location.protocol === 'file:') {
          throw new Error('O navegador bloqueia a leitura de arquivos locais (file://). Abra o painel pelo arquivo "iniciar_painel.bat".');
        }
        throw e;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ao carregar ${url}`);
      return res.json();
    };
    const [gi, ge, gr] = await Promise.all([
      buscar(CONFIG.arquivos.impacto), buscar(CONFIG.arquivos.edificacoes), buscar(CONFIG.arquivos.regional)
    ]);
    return montar(gi, ge, gr, root.proj4);
  }

  const DataLoader = { montar, carregar, ehMedia, faixaDe };
  root.DataLoader = DataLoader;
  if (typeof module !== 'undefined' && module.exports) module.exports = DataLoader;
})(typeof window !== 'undefined' ? window : globalThis);
