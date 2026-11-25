/**
 * filter-state.js
 * Estado global e ÚNICO de filtros (Global Filter State).
 * Filtros laterais, cliques nos gráficos e cliques no mapa leem e alteram SOMENTE este objeto.
 * As notificações são agrupadas (microtask) para que várias alterações gerem uma única
 * atualização da interface, evitando ciclos e renderizações repetidas.
 *
 * Lógica: AND entre dimensões diferentes; OR entre categorias da mesma dimensão.
 */
(function (root) {
  'use strict';

  const DIMS_CONJUNTO = ['regional', 'bairro', 'uso', 'enq', 'grupo', 'faixa_und', 'faixa_vagas', 'faixa_area', 'faixa_pop'];
  const VARS = ['und', 'vagas', 'area', 'pop'];

  class FilterState {
    constructor() {
      this.ouvintes = [];
      this.pendentes = new Set();
      this.agendado = false;
      this._inicial();
    }

    _inicial() {
      this.s = {};
      DIMS_CONJUNTO.forEach(d => { this.s[d] = new Set(); });
      this.s.range = {};
      VARS.forEach(v => { this.s.range[v] = { min: null, max: null }; });
      this.s.medias = false;
      this.s.empreendimento = null;
    }

    get() { return this.s; }

    subscribe(fn) { this.ouvintes.push(fn); }

    _mudou(dim) {
      this.pendentes.add(dim);
      if (this.agendado) return;
      this.agendado = true;
      const flush = () => {
        this.agendado = false;
        const mud = new Set(this.pendentes);
        this.pendentes.clear();
        this.ouvintes.forEach(fn => fn(mud));
      };
      (typeof queueMicrotask === 'function' ? queueMicrotask : f => Promise.resolve().then(f))(flush);
    }

    toggle(dim, chave) {
      const set = this.s[dim];
      if (set.has(chave)) set.delete(chave); else set.add(chave);
      this._mudou(dim);
    }

    setConjunto(dim, valores) {
      this.s[dim] = new Set(valores);
      this._mudou(dim);
    }

    limpar(dim) {
      if (DIMS_CONJUNTO.includes(dim)) this.s[dim].clear();
      else if (dim === 'medias') this.s.medias = false;
      else if (dim === 'empreendimento') this.s.empreendimento = null;
      else if (dim.startsWith('range_')) this.s.range[dim.slice(6)] = { min: null, max: null };
      this._mudou(dim);
    }

    setRange(v, min, max) {
      const n = x => (x === '' || x === null || x === undefined || !Number.isFinite(Number(x))) ? null : Number(x);
      this.s.range[v] = { min: n(min), max: n(max) };
      this._mudou('range_' + v);
    }

    setMedias(b) { this.s.medias = !!b; this._mudou('medias'); }

    setEmpreendimento(uid) { this.s.empreendimento = uid || null; this._mudou('empreendimento'); }

    limparTudo() {
      this._inicial();
      this._mudou('*');
    }

    /** Existe algum filtro/seleção ativo? */
    ativo() {
      return DIMS_CONJUNTO.some(d => this.s[d].size > 0) || this.s.medias || !!this.s.empreendimento ||
        VARS.some(v => this.s.range[v].min !== null || this.s.range[v].max !== null);
    }
  }

  FilterState.DIMS_CONJUNTO = DIMS_CONJUNTO;
  FilterState.VARS = VARS;
  root.FilterState = FilterState;
  if (typeof module !== 'undefined' && module.exports) module.exports = FilterState;
})(typeof window !== 'undefined' ? window : globalThis);
