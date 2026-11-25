/**
 * panels-view.js
 * Indicadores (KPIs), etiquetas de filtros ativos, comparação empreendimento × bairro,
 * análise das edificações médias, selo de consistência e relatório de qualidade dos dados.
 */
(function (root) {
  'use strict';
  const { CONFIG, FilterEngine: FE, Util } = root;
  const V = CONFIG.variaveis;

  class PanelsView {
    constructor(state) { this.state = state; }

    iniciar(dados) {
      this.dados = dados;
      document.getElementById('chips').addEventListener('click', e => {
        const b = e.target.closest('[data-rm]');
        if (!b) return;
        const [dim, val] = [b.dataset.rm, b.dataset.val];
        if (val !== undefined && this.state.get()[dim] instanceof Set) this.state.toggle(dim, val);
        else this.state.limpar(dim);
      });
    }

    // ---------- KPIs ----------
    kpis(f) {
      const c = FE.totais(f.comuns), i = FE.totais(f.impacto);
      const nMedias = f.comuns.filter(r => r.media).length;
      const set = (id, v) => { document.getElementById(id).textContent = v; };
      set('kN_comuns', Util.fmt(c.n));
      set('kN_medias', Util.fmt(nMedias));
      set('kN_medias_pct', c.n ? `${Util.fmtPct(FE.pct(nMedias, c.n))} das comuns filtradas` : '—');
      set('kN_impacto', Util.fmt(i.n));
      FE.VARS.forEach(v => {
        const casas = v === 'area' ? 0 : 0;
        set(`k_${v}_c`, Util.fmt(c[v], casas));
        set(`k_${v}_i`, Util.fmt(i[v], casas));
        const semInf = i.n - i[v + '_inf'];
        set(`k_${v}_nota`, semInf > 0 ? `${semInf} emp. de impacto sem valor informado` : '');
      });
      return { comuns: c, impacto: i, nMedias };
    }

    // ---------- Filtros ativos ----------
    chips(s) {
      const out = [];
      const chip = (dim, val, rotulo, tipo = '') =>
        out.push(`<span class="chip ${tipo}"><span>${rotulo}</span><button type="button" title="Remover" data-rm="${dim}" ${val !== null ? `data-val="${Util.esc(val)}"` : ''}>×</button></span>`);
      if (s.empreendimento) {
        const e = this.dados.impacto.find(r => r.uid === s.empreendimento);
        chip('empreendimento', null, `<b>Empreendimento:</b> ${Util.esc(e ? e.nome : s.empreendimento)}`, 'chip-imp');
      }
      s.regional.forEach(v => chip('regional', v, `<b>Regional:</b> ${Util.esc(Util.titulo(v))}`));
      s.bairro.forEach(v => chip('bairro', v, `<b>Bairro:</b> ${Util.esc(v)}`));
      s.uso.forEach(v => chip('uso', v, `<b>Uso:</b> ${Util.esc(v)}`));
      s.enq.forEach(v => chip('enq', v, `<b>Enquadramento:</b> ${Util.esc(v)}`));
      s.grupo.forEach(v => chip('grupo', v, `<b>Grupo:</b> ${Util.esc(CONFIG.grupos.find(g => g.k === v).rotulo)}`));
      FE.VARS.forEach(v => {
        s['faixa_' + v].forEach(k => chip('faixa_' + v, k, `<b>${V[v].rotulo}:</b> faixa ${Util.esc(CONFIG.faixas[v].find(b => b.k === k).rotulo)}`));
        const rg = s.range[v];
        if (rg.min !== null || rg.max !== null) {
          const t = rg.min !== null && rg.max !== null ? `${Util.fmt(rg.min)} a ${Util.fmt(rg.max)}` : rg.min !== null ? `≥ ${Util.fmt(rg.min)}` : `≤ ${Util.fmt(rg.max)}`;
          chip('range_' + v, null, `<b>${V[v].rotulo}:</b> ${t}`);
        }
      });
      if (s.medias) chip('medias', null, '<b>Somente edificações médias</b>', 'chip-med');
      const box = document.getElementById('chips');
      box.innerHTML = out.length ? out.join('') : '<span class="chips-vazio">Nenhum filtro ativo — exibindo todos os registros</span>';
      document.body.classList.toggle('filtro-ativo', out.length > 0);
    }

    // ---------- Comparação empreendimento × bairro ----------
    comparacao(s) {
      const box = document.getElementById('cmpCorpo');
      const cmp = FE.comparacao(this.dados, s);
      if (!cmp) {
        box.innerHTML = `<p class="hint">Selecione um <b>Empreendimento de Impacto</b> (lista lateral ou botão no quadro do ponto) para compará-lo com as edificações comuns do mesmo bairro.</p>`;
        return;
      }
      const e = cmp.emp, c = cmp.comuns, m = cmp.medias;
      const linhas = FE.VARS.map(v => {
        const ev = e[v];
        const media = c.n ? c[v] / c.n : null;
        const razao = ev !== null && c[v] > 0 ? ev / c[v] : null;
        const casas = v === 'area' ? 2 : 0;
        return `<tr><td>${V[v].rotulo}</td>
          <td class="num imp">${ev === null ? `<span class="ni">${Util.NI}</span>` : Util.fmt(ev, casas)}</td>
          <td class="num">${Util.fmt(c[v], casas)}</td>
          <td class="num">${Util.fmt(media, 1)}</td>
          <td class="num">${razao === null ? '—' : Util.fmt(razao * 100, 1) + '%'}</td></tr>`;
      }).join('');
      box.innerHTML = `
        <div class="cmp-head"><span class="tag tag-imp">Impacto</span> <b>${Util.esc(e.nome)}</b><br>
          <small>Bairro <b>${Util.esc(e.bairro)}</b> · Regional ${Util.esc(Util.titulo(e.regional))} · Uso ${Util.esc(e.uso || Util.NI)}</small></div>
        <table class="cmp-tab">
          <thead><tr><th></th><th>Empreend. (individual)</th><th>Comuns do bairro (soma)</th><th>Média por edif. comum</th><th>Empreend. ÷ soma comuns</th></tr></thead>
          <tbody>
            <tr><td>Quantidade de registros</td><td class="num imp">1</td><td class="num">${Util.fmt(c.n)}</td><td class="num">—</td><td class="num">—</td></tr>
            ${linhas}
          </tbody>
        </table>
        <p class="nota">Edificações médias no bairro (com os filtros vigentes): <b>${Util.fmt(m.n)}</b> de ${Util.fmt(c.n)}.
        ${c.n === 0 ? '<br><b>Não há edificações comuns neste bairro com os filtros atuais.</b>' : ''}</p>`;
    }

    // ---------- Comparativo: comuns (todas) × médias × impacto ----------
    // Permite comparar os empreendimentos de impacto com TODAS as edificações comuns do universo
    // filtrado (inclusive quando não há edificações médias, p.ex. no bairro do empreendimento selecionado).
    comparativoComuns(f) {
      const box = document.getElementById('comCorpo');
      const med = f.comuns.filter(r => r.media), dem = f.comuns.filter(r => !r.media);
      const tc = FE.totais(f.comuns), tm = FE.totais(med), td = FE.totais(dem), ti = FE.totais(f.impacto);
      const media = (t, v) => t[v + '_inf'] ? t[v] / t[v + '_inf'] : null;
      const casas = v => v === 'area' ? 0 : 0;
      const cel = (val, cls = '', c = 0) => `<td class="num ${cls}">${val === null ? '—' : Util.fmt(val, c)}</td>`;
      const linhasTot = `<tr><td>Registros</td>${cel(tc.n)}${cel(tm.n, 'med')}${cel(ti.n, 'imp')}</tr>` +
        FE.VARS.map(v => `<tr><td>${V[v].rotulo}${v === 'area' ? ' (m²)' : ''}</td>${cel(tc[v], '', casas(v))}${cel(tm[v], 'med', casas(v))}${cel(ti[v], 'imp', casas(v))}</tr>`).join('');
      const linhasMed = FE.VARS.map(v => `<tr><td>${V[v].rotulo}</td>${cel(media(tc, v), '', 1)}${cel(media(tm, v), 'med', 1)}${cel(media(ti, v), 'imp', 1)}</tr>`).join('');

      // Barras 100%: participação de cada grupo no total (comuns + impacto)
      const barra = (rot, a, b, c) => {
        const tot = a + b + c;
        if (!tot) return `<div class="stk"><div class="stk-top"><span>${rot}</span><b>—</b></div><div class="stk-trk"></div></div>`;
        const p = x => x / tot * 100;
        return `<div class="stk"><div class="stk-top"><span>${rot}</span><span>impacto <b class="imp">${Util.fmtPct(p(c))}</b></span></div>
          <div class="stk-trk">
            <div class="stk-seg com" style="width:${p(a)}%" title="Comuns (exceto médias): ${Util.fmt(a)} (${Util.fmtPct(p(a))})"></div>
            <div class="stk-seg med" style="width:${p(b)}%" title="Médias: ${Util.fmt(b)} (${Util.fmtPct(p(b))})"></div>
            <div class="stk-seg imp" style="width:${p(c)}%" title="Impacto: ${Util.fmt(c)} (${Util.fmtPct(p(c))})"></div>
          </div>
          <small>comuns ${Util.fmtPct(p(a))} · médias ${Util.fmtPct(p(b))} · impacto ${Util.fmtPct(p(c))}</small></div>`;
      };
      const semMedias = tc.n > 0 && tm.n === 0
        ? '<p class="aviso-med">Não há edificações médias neste universo: a comparação usa todas as edificações comuns.</p>' : '';
      box.innerHTML = `${semMedias}
        <table class="cmp-tab cmp3">
          <thead><tr><th></th><th class="th-com">Comuns<br>(todas)</th><th class="th-med">das quais<br>médias</th><th class="th-imp">Impacto</th></tr></thead>
          <tbody>${linhasTot}</tbody>
          <tbody class="sub"><tr><td colspan="4">Média por registro</td></tr>${linhasMed}</tbody>
        </table>
        <div class="stk-leg"><span class="dot com"></span>comuns (exceto médias) <span class="dot med"></span>médias <span class="dot imp"></span>impacto</div>
        ${barra('Registros', td.n, tm.n, ti.n)}
        ${FE.VARS.map(v => barra(V[v].rotulo, td[v], tm[v], ti[v])).join('')}
        <p class="nota">Universo: todos os filtros ativos. Com um empreendimento selecionado, compara o empreendimento com as edificações comuns do seu bairro. Médias por registro consideram apenas registros com valor informado.</p>`;
      return { comuns: tc, medias: tm, demais: td, impacto: ti };
    }
  }

  root.PanelsView = PanelsView;
})(window);
