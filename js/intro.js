/**
 * intro.js
 * Página de introdução (entrada do relatório) e navegação introdução ⇄ relatório.
 *  - Endereço sem "#painel"  → introdução;  "#painel" → relatório (permite voltar pelo navegador e abrir direto).
 *  - O relatório é carregado em segundo plano enquanto a introdução é lida; o botão
 *    "Ir para o relatório" é liberado quando os dados terminam de carregar e de ser validados.
 *  - Os números citados na introdução são calculados dos mesmos dados e do mesmo motor do relatório.
 */
(function (root) {
  'use strict';
  const { CONFIG, Util } = root;

  const Intro = {
    pronto: false,
    aoMostrarRelatorio: null,

    rota() { return location.hash === '#painel' ? 'painel' : 'intro'; },

    aplicarRota() {
      const intro = document.getElementById('intro');
      const modo = this.rota();
      if (modo === 'painel' && !this.pronto) {
        document.getElementById('carregando').hidden = false;  // acesso direto por #painel: aguarda a carga
      }
      intro.hidden = modo !== 'intro';
      document.body.classList.toggle('modo-intro', modo === 'intro');
      document.title = modo === 'intro'
        ? 'Introdução – Edificações Comuns × Empreendimentos de Impacto | DALU / Suplan PBH'
        : 'Relatório – Edificações Comuns × Empreendimentos de Impacto | DALU / Suplan PBH';
      if (modo === 'painel' && this.aoMostrarRelatorio) this.aoMostrarRelatorio();
    },

    iniciar() {
      document.querySelectorAll('.js-ref').forEach(e => { e.textContent = CONFIG.referenciaDados; });
      this.botoes(false);
      document.querySelectorAll('[data-ir-relatorio]').forEach(b => b.addEventListener('click', () => {
        if (!this.pronto) return;
        location.hash = 'painel';
      }));
      document.getElementById('btnIntro').addEventListener('click', () => {
        history.pushState(null, '', location.pathname + location.search);  // remove "#painel"
        this.aplicarRota();
        document.getElementById('intro').scrollTop = 0;
      });
      window.addEventListener('hashchange', () => this.aplicarRota());
      window.addEventListener('popstate', () => this.aplicarRota());
      if (this.rota() === 'intro') document.getElementById('carregando').hidden = true;
      this.aplicarRota();
    },

    botoes(ok) {
      document.querySelectorAll('[data-ir-relatorio]').forEach(b => {
        b.disabled = !ok;
        if (b.id === 'btnIrRelatorio') b.textContent = ok ? 'Ir para o relatório' : 'Carregando os dados…';
      });
    },

    /** Preenche os números da introdução com os dados carregados (mesmo motor do relatório). */
    preencher(dados, FE) {
      const set = (sel, v) => document.querySelectorAll(sel).forEach(e => { e.textContent = v; });
      const tc = FE.totais(dados.comuns), ti = FE.totais(dados.impacto);
      const tm = FE.totais(dados.comuns.filter(r => r.media));
      set('.js-n-comuns', Util.fmt(tc.n));
      set('.js-n-impacto', Util.fmt(ti.n));
      set('.js-n-medias', Util.fmt(tm.n));
      set('.js-n-regionais', Util.fmt(dados.regional.features.length));

      const enq = Object.entries(dados.qualidade.enquadramentoMapa).sort((a, b) => b[1] - a[1]);
      document.getElementById('introEnq').innerHTML =
        enq.map(([k, n]) => `<li><span>${Util.esc(k)}</span><b title="empreendimentos">${n}</b></li>`).join('');

      const T = v => tc[v] + ti[v];
      const p = (a, b) => Util.fmtPct(b ? a / b * 100 : null);
      const nb = new Set(dados.todos.map(r => r.bairro)).size;
      document.getElementById('introDestaque').innerHTML =
        `<b>Retrato da base completa (sem filtros):</b> ${Util.fmt(ti.n + tc.n)} registros em ${Util.fmt(nb)} bairros e ` +
        `${dados.regional.features.length} regionais. Os ${Util.fmt(ti.n)} empreendimentos de impacto representam ${p(ti.n, ti.n + tc.n)} dos registros e ` +
        `concentram ${p(ti.und, T('und'))} das unidades residenciais, ${p(ti.vagas, T('vagas'))} das vagas e ${p(ti.area, T('area'))} da área construída. ` +
        `As edificações comuns respondem pelo restante: <b>${p(tc.und, T('und'))} das unidades</b> e <b>${p(tc.area, T('area'))} da área</b>. ` +
        `Só as ${Util.fmt(tm.n)} edificações médias (${p(tm.n, tc.n)} das comuns) somam ${p(tm.und, T('und'))} das unidades e ${p(tm.area, T('area'))} da área.`;

      this.pronto = true;
      this.botoes(true);
      document.getElementById('introStatus').textContent = '';
      if (this.rota() === 'painel') this.aplicarRota();
    },

    erro(msg) {
      document.getElementById('introStatus').innerHTML = `<span class="erro">Não foi possível carregar os dados: ${Util.esc(msg)}</span>`;
      document.querySelectorAll('[data-ir-relatorio]').forEach(b => { b.disabled = true; });
      const b = document.getElementById('btnIrRelatorio');
      if (b) b.textContent = 'Dados indisponíveis';
    }
  };

  root.Intro = Intro;
})(window);
