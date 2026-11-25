/**
 * filter-engine.js
 * Motor de filtragem e agregação (funções puras, sem DOM).
 * Todos os componentes (mapa, KPIs, gráficos, comparações e validação) usam ESTE motor
 * sobre o MESMO estado global, garantindo um único universo de dados.
 *
 * Regras:
 *  - AND entre dimensões; OR dentro de cada dimensão.
 *  - "enq" (Enquadramento) só existe para empreendimentos de impacto: não restringe edificações comuns.
 *  - "medias" (Edificações Médias) só restringe edificações comuns.
 *  - Filtro numérico (mín/máx) ativo + valor nulo => registro excluído (não é possível verificar o critério).
 *  - Empreendimento selecionado: impacto = somente o selecionado; comuns = mesmo bairro do selecionado
 *    (os filtros de Regional/Bairro deixam de valer para as comuns, demais filtros continuam valendo).
 */
(function (root) {
  'use strict';

  const VARS = ['und', 'vagas', 'area', 'pop'];

  function comoArray(x) { return x === undefined || x === null ? [] : (Array.isArray(x) ? x : [x]); }

  /** Testa um registro contra o estado. `excluir` = dimensão(ões) ignoradas (cross-filter do próprio gráfico). */
  function passa(r, s, excluir, emp) {
    const ex = excluir instanceof Set ? excluir : new Set(comoArray(excluir));

    // Empreendimento selecionado
    if (emp && !ex.has('empreendimento')) {
      if (r.tipo === 'impacto') return r.uid === emp.uid;
      if (r.bairroKey !== emp.bairroKey) return false;
    } else {
      if (!ex.has('regional') && s.regional.size && !s.regional.has(r.regional)) return false;
      if (!ex.has('bairro') && s.bairro.size && !s.bairro.has(r.bairro)) return false;
    }

    if (!ex.has('uso') && s.uso.size && !s.uso.has(r.uso)) return false;
    if (!ex.has('grupo') && s.grupo.size && !s.grupo.has(r.grupo)) return false;
    if (r.tipo === 'impacto' && !ex.has('enq') && s.enq.size && !r.enq.some(e => s.enq.has(e))) return false;
    if (r.tipo === 'comum' && !ex.has('medias') && s.medias && !r.media) return false;

    for (const v of VARS) {
      const fd = 'faixa_' + v;
      if (!ex.has(fd) && s[fd].size && !s[fd].has(r.faixa[v])) return false;
      const rg = s.range[v];
      if (!ex.has('range_' + v) && (rg.min !== null || rg.max !== null)) {
        const val = r[v];
        if (val === null) return false;
        if (rg.min !== null && val < rg.min) return false;
        if (rg.max !== null && val > rg.max) return false;
      }
    }
    return true;
  }

  function empreendimentoSelecionado(dados, s) {
    return s.empreendimento ? (dados.impacto.find(r => r.uid === s.empreendimento) || null) : null;
  }

  /** Filtra todos os registros. Retorna listas separadas por grupo de origem. */
  function filtrar(dados, s, excluir) {
    const ex = new Set(comoArray(excluir));
    const emp = empreendimentoSelecionado(dados, s);
    const comuns = [], impacto = [];
    for (const r of dados.todos) {
      if (!passa(r, s, ex, emp)) continue;
      (r.tipo === 'impacto' ? impacto : comuns).push(r);
    }
    return { comuns, impacto, emp };
  }

  /** Soma com controle de nulos: devolve soma e quantidade de registros com valor informado. */
  function totais(lista) {
    const t = { n: lista.length };
    VARS.forEach(v => {
      let soma = 0, inf = 0;
      for (const r of lista) if (r[v] !== null) { soma += r[v]; inf++; }
      t[v] = soma;
      t[v + '_inf'] = inf;
    });
    return t;
  }

  /** Conta registros por categoria. fnCat pode devolver string ou array (multivalorado). */
  function contar(lista, fnCat, metrica) {
    const m = {};
    for (const r of lista) {
      const cats = comoArray(fnCat(r));
      const val = metrica && metrica !== 'n' ? (r[metrica] || 0) : 1;
      for (const c of cats) { if (c === null || c === undefined) continue; m[c] = (m[c] || 0) + val; }
    }
    return m;
  }

  function pct(a, b) { return b > 0 ? (a / b) * 100 : null; }

  /** Indicadores das edificações médias sobre o universo de comuns (todos os filtros exceto Médias/Grupo). */
  function analiseMedias(dados, s) {
    const u = filtrar(dados, s, ['medias', 'grupo']).comuns;
    const m = u.filter(r => r.media);
    const tu = totais(u), tm = totais(m);
    const out = { universo: tu, medias: tm, pct: { n: pct(tm.n, tu.n) } };
    VARS.forEach(v => { out.pct[v] = pct(tm[v], tu[v]); });
    return out;
  }

  /** Comparação: empreendimento selecionado x edificações comuns do mesmo bairro (filtros vigentes). */
  function comparacao(dados, s) {
    const f = filtrar(dados, s);
    if (!f.emp) return null;
    const agg = totais(f.comuns);
    const med = totais(f.comuns.filter(r => r.media));
    return { emp: f.emp, comuns: agg, medias: med };
  }

  const FilterEngine = { passa, filtrar, totais, contar, pct, analiseMedias, comparacao, empreendimentoSelecionado, VARS };
  root.FilterEngine = FilterEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = FilterEngine;
})(typeof window !== 'undefined' ? window : globalThis);
