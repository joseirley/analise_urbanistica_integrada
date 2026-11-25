/**
 * charts-view.js
 * Gráficos interativos (Chart.js) com comportamento de cross-filtering/cross-highlighting:
 *  - cada gráfico é calculado com TODOS os filtros ativos, exceto o da sua própria dimensão
 *    (assim as categorias não desaparecem ao serem clicadas e a seleção é destacada);
 *  - clique numa categoria => alterna a categoria no estado global (OR na dimensão);
 *  - categorias não selecionadas ficam esmaecidas quando há seleção na dimensão.
 * Os gráficos NÃO filtram dados por conta própria: apenas leem o estado e pedem alterações a ele.
 */
(function (root) {
  'use strict';
  const { CONFIG, FilterEngine: FE, Util } = root;
  const C = CONFIG.cores;

  const SERIES_CI = [
    { k: 'comuns', rotulo: 'Edificações comuns', cor: C.comum, f: r => r.tipo === 'comum' },
    { k: 'impacto', rotulo: 'Empreendimentos de impacto', cor: C.impacto, f: r => r.tipo === 'impacto' }
  ];
  const SERIES_CMI = [
    { k: 'comuns', rotulo: 'Edificações comuns (total)', cor: C.comum, f: r => r.tipo === 'comum' },
    { k: 'medias', rotulo: 'das quais médias', cor: C.media, f: r => r.tipo === 'comum' && r.media },
    { k: 'impacto', rotulo: 'Empreendimentos de impacto', cor: C.impacto, f: r => r.tipo === 'impacto' }
  ];

  // Três grupos mutuamente exclusivos: comuns (exceto médias), médias e impacto
  const SERIES_GRUPOS = [
    { k: 'demais', rotulo: 'Edificações comuns (exceto médias)', cor: C.comum, f: r => r.grupo === 'comum_demais' },
    { k: 'medias', rotulo: 'Edificações médias', cor: C.media, f: r => r.grupo === 'media' },
    { k: 'impacto', rotulo: 'Empreendimentos de impacto', cor: C.impacto, f: r => r.tipo === 'impacto' }
  ];

  function quebrar(txt, max = 30) {
    const out = []; let l = '';
    String(txt).split(' ').forEach(w => {
      if ((l + ' ' + w).trim().length > max) { if (l) out.push(l); l = w; } else l = (l + ' ' + w).trim();
    });
    if (l) out.push(l);
    return out.length > 1 ? out : out[0];
  }
  function alfa(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }

  class ChartsView {
    constructor(state) {
      this.state = state;
      this.charts = {};
      this.escala = 'n';          // n | pct
      this.ordBairro = 'comuns';
      this.metGrupo = 'n';
      this.ultimo = {};           // dados calculados (para validação)
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.font.size = 11;
      Chart.defaults.color = '#334155';
    }

    defs(dados) {
      const regionais = dados.regional.features.map(f => f.properties.nome_regional);
      const bairros = [...new Set(dados.todos.map(r => r.bairro))];
      const enqs = Object.keys(dados.qualidade.enquadramentoMapa);
      // Distribuições: soma do PRÓPRIO dado (unidades, vagas, área, população) em cada faixa,
      // separada entre comuns, médias e impacto. A faixa "Não informado" soma sempre 0 e não é exibida.
      const faixa = v => ({
        id: 'faixa_' + v, dim: 'faixa_' + v, canvas: 'chFaixa_' + v, horizontal: false,
        cats: () => CONFIG.faixas[v].filter(b => b.k !== 'ni').map(b => ({ k: b.k, rotulo: b.rotulo })),
        catDe: r => r.faixa[v], series: SERIES_GRUPOS, metrica: () => v
      });
      return [
        { id: 'regional', dim: 'regional', canvas: 'chRegional', horizontal: true, series: SERIES_CMI,
          cats: () => regionais.map(k => ({ k, rotulo: Util.titulo(k) })), catDe: r => r.regional, ordenar: 'comuns' },
        { id: 'bairro', dim: 'bairro', canvas: 'chBairro', horizontal: true, series: SERIES_CMI, topN: 15,
          cats: () => bairros.map(k => ({ k, rotulo: k })), catDe: r => r.bairro, ordenar: () => this.ordBairro },
        { id: 'uso', dim: 'uso', canvas: 'chUso', horizontal: false, series: SERIES_CI,
          cats: () => CONFIG.usos.map(k => ({ k, rotulo: k })), catDe: r => r.uso },
        { id: 'enq', dim: 'enq', canvas: 'chEnq', horizontal: true, multivalorado: true, semEscala: true,
          series: [SERIES_CI[1]], cats: () => enqs.map(k => ({ k, rotulo: quebrar(k, 34) })), catDe: r => r.enq, ordenar: 'impacto' },
        faixa('und'), faixa('vagas'), faixa('area'), faixa('pop'),
        { id: 'grupo', dim: 'grupo', canvas: 'chGrupo', horizontal: false, semEscala: true,
          series: [{ k: 'grupos', rotulo: 'Grupo', cor: null, f: () => true }],
          cats: () => CONFIG.grupos.map(g => ({ k: g.k, rotulo: quebrar(g.rotulo, 20) })), catDe: r => r.grupo,
          metrica: () => this.metGrupo, coresCat: { comum_demais: C.comum, media: C.media, impacto: C.impacto } }
      ];
    }

    iniciar(dados) {
      this.dados = dados;
      this.lista = this.defs(dados);
      this.lista.forEach(d => this._criar(d));
    }

    _criar(d) {
      const cv = document.getElementById(d.canvas);
      if (!cv) return;
      const self = this;
      const eixoCat = d.horizontal ? 'y' : 'x', eixoVal = d.horizontal ? 'x' : 'y';
      // Rótulos de valor acima das barras (gráficos verticais): mantêm legíveis as barras pequenas
      // sem alterar a escala comum.
      const rotulosValor = !d.horizontal ? [{
        id: 'rotulos_' + d.id,
        afterDatasetsDraw(c) {
          const ctx = c.ctx;
          ctx.save(); ctx.font = '600 10px Segoe UI, sans-serif'; ctx.textAlign = 'center';
          c.data.datasets.forEach((ds, di) => {
            const meta = c.getDatasetMeta(di);
            if (meta.hidden) return;
            const sk = d.series[di].k;
            meta.data.forEach((el, i) => {
              const v = c._meta && c._meta.bruto[sk] ? c._meta.bruto[sk][i] : 0;
              if (!v) return;
              ctx.fillStyle = sk === 'impacto' ? '#b91c1c' : '#0f172a';
              ctx.fillText(Util.compacto(v), el.x, el.y - 4);
            });
          });
          ctx.restore();
        }
      }] : [];
      const ch = new Chart(cv, {
        type: 'bar',
        data: { labels: [], datasets: d.series.map(s => ({ label: s.rotulo, data: [], backgroundColor: s.cor, borderRadius: 3, maxBarThickness: 26})) },
        plugins: rotulosValor,
        options: {
          indexAxis: d.horizontal ? 'y' : 'x',
          responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
          layout: { padding: { top: d.horizontal ? 0 : 16 } },
          interaction: { mode: 'index', intersect: false, axis: eixoCat },
          plugins: {
            legend: { display: d.series.length > 1, position: 'top', labels: { boxWidth: 10, boxHeight: 10, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: it => {
                  const meta = ch._meta || {};
                  const sk = d.series[it.datasetIndex].k;
                  const bruto = (meta.bruto && meta.bruto[sk] && meta.bruto[sk][it.dataIndex]) || 0;
                  const tot = (meta.tot && meta.tot[sk]) || 0;
                  const met = d.metrica ? d.metrica() : 'n';
                  const un = met === 'n' ? 'registros' : CONFIG.variaveis[met].unidade;
                  const casas = met === 'area' ? 2 : 0;
                  return ` ${it.dataset.label}: ${Util.fmt(bruto, casas)} ${un} (${Util.fmtPct(FE.pct(bruto, tot))} da série)`;
                }
              }
            }
          },
          scales: {
            // Eixo ÚNICO para todas as séries: a proporção entre as barras é comparável diretamente
            [eixoVal]: { beginAtZero: true, grid: { color: '#eef2f7' },
              ticks: { precision: 0, callback: v => this.escala === 'pct' && !d.semEscala ? v + '%' : Util.compacto(v) } },
            [eixoCat]: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 10 } } },
          },
          onClick: (evt) => {
            const els = ch.getElementsAtEventForMode(evt, 'index', { intersect: false, axis: eixoCat }, true);
            if (!els.length) return;
            const k = ch._keys[els[0].index];
            if (k !== undefined) self.state.toggle(d.dim, k);
          },
          onHover: (evt, els) => { evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
        }
      });
      ch._keys = [];
      this.charts[d.id] = ch;
    }

    atualizar(s) {
      const dados = this.dados;
      this.ultimo = {};
      this.lista.forEach(d => {
        const ch = this.charts[d.id];
        if (!ch) return;
        const univ = FE.filtrar(dados, s, d.dim);
        const regs = univ.comuns.concat(univ.impacto);
        const met = d.metrica ? d.metrica() : 'n';
        const porSerie = {}, tot = {};
        d.series.forEach(se => {
          porSerie[se.k] = FE.contar(regs.filter(se.f), d.catDe, met);
          tot[se.k] = d.multivalorado ? regs.filter(se.f).length : Object.values(porSerie[se.k]).reduce((a, b) => a + b, 0);
        });
        this.ultimo[d.id] = { dim: d.dim, porSerie, multivalorado: !!d.multivalorado, metrica: met };

        // categorias e ordenação
        let cats = d.cats();
        const ord = typeof d.ordenar === 'function' ? d.ordenar() : d.ordenar;
        if (ord) cats = cats.slice().sort((a, b) => ((porSerie[ord] || {})[b.k] || 0) - ((porSerie[ord] || {})[a.k] || 0) ||
          String(a.rotulo).localeCompare(String(b.rotulo), 'pt-BR'));
        if (d.topN) {
          const sel = s[d.dim];
          const comValor = cats.filter(c => d.series.some(se => (porSerie[se.k][c.k] || 0) > 0) || sel.has(c.k));
          const top = comValor.slice(0, d.topN);
          comValor.forEach(c => { if (sel.has(c.k) && !top.includes(c)) top.push(c); });
          cats = top;
        }
        const sel = s[d.dim];
        const temSel = sel.size > 0;
        ch._keys = cats.map(c => c.k);
        ch.data.labels = cats.map(c => c.rotulo);
        ch._meta = { bruto: {}, tot };
        d.series.forEach((se, i) => {
          const bruto = cats.map(c => porSerie[se.k][c.k] || 0);
          ch._meta.bruto[se.k] = bruto;
          const pctMode = this.escala === 'pct' && !d.semEscala;
          ch.data.datasets[i].data = pctMode ? bruto.map(v => tot[se.k] ? +(v / tot[se.k] * 100).toFixed(2) : 0) : bruto;
          ch.data.datasets[i].backgroundColor = cats.map(c => {
            const base = d.coresCat ? d.coresCat[c.k] : se.cor;
            return temSel && !sel.has(c.k) ? alfa(base, 0.22) : base;
          });
          ch.data.datasets[i].borderColor = cats.map(c => temSel && sel.has(c.k) ? '#0f172a' : 'transparent');
          ch.data.datasets[i].borderWidth = cats.map(c => temSel && sel.has(c.k) ? 1.5 : 0);
        });
        if (d.id === 'bairro') {
          const box = document.getElementById('boxBairro');
          if (box) box.style.height = Math.max(260, cats.length * 30 + 60) + 'px';
        }
        ch.update();
        const card = document.querySelector(`[data-chart="${d.id}"]`);
        if (card) {
          card.classList.toggle('com-selecao', temSel);
          const n = card.querySelector('.chart-sel');
          if (n) n.textContent = temSel ? `${sel.size} selecionado(s)` : '';
        }
      });
      return this.ultimo;
    }
  }

  root.ChartsView = ChartsView;
})(window);
