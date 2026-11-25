/**
 * validation.js
 * Verificações de consistência executadas a CADA atualização do painel.
 * Confrontam, de forma independente, o universo filtrado com o que foi efetivamente
 * apresentado no mapa, nos indicadores, nos gráficos e na superfície de densidade.
 * Qualquer divergência é exibida no selo "Consistência" do cabeçalho e no console.
 */
(function (root) {
  'use strict';
  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);
  const FE = root.FilterEngine || (typeof require !== 'undefined' ? require('./filter-engine.js') : null);

  const TOL = 1e-6;
  const igual = (a, b) => Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));

  /**
   * @param ctx {dados, s, filtrado, kpis, mapa:{comuns,impacto}, graficos:{id:{dim, porSerie:{serie:{cat:val}}, selecionado}}, kde}
   */
  function verificar(ctx) {
    const R = [];
    const ok = (cond, msg) => R.push({ ok: !!cond, msg });
    const { dados, s, filtrado, kpis } = ctx;

    // 1) Recontagem independente do universo filtrado (sem usar FE.filtrar)
    const emp = FE.empreendimentoSelecionado(dados, s);
    let nc = 0, ni = 0;
    dados.todos.forEach(r => { if (FE.passa(r, s, null, emp)) (r.tipo === 'impacto' ? ni++ : nc++); });
    ok(nc === filtrado.comuns.length && ni === filtrado.impacto.length,
      `Universo filtrado recontado: ${nc} comuns / ${ni} impacto`);

    // 2) Regras específicas
    if (emp) {
      ok(filtrado.impacto.length === 1 && filtrado.impacto[0].uid === emp.uid, 'Empreendimento selecionado é o único impacto exibido');
      ok(filtrado.comuns.every(r => r.bairroKey === emp.bairroKey), `Todas as comuns pertencem ao bairro ${emp.bairro}`);
    }
    if (s.medias) ok(filtrado.comuns.every(r => r.media), 'Filtro Médias: todas as comuns exibidas atendem à regra');
    ok(filtrado.comuns.every(r => r.media === CONFIG.limiaresMedias.some(l => r[l.campo] !== null && r[l.campo] >= l.min && r[l.campo] <= l.max)),
      'Classificação de edificação média confere com a regra (OR, limites inclusivos)');

    // 3) KPIs = soma direta dos registros filtrados
    if (kpis) {
      ['comuns', 'impacto'].forEach(g => {
        const lista = filtrado[g];
        ok(kpis[g].n === lista.length, `KPI quantidade (${g}) = ${lista.length}`);
        FE.VARS.forEach(v => {
          const soma = lista.reduce((a, r) => a + (r[v] === null ? 0 : r[v]), 0);
          ok(igual(kpis[g][v], soma), `KPI ${v} (${g}) confere com a soma dos registros`);
        });
      });
      ok(kpis.nMedias === filtrado.comuns.filter(r => r.media).length && kpis.nMedias <= kpis.comuns.n, 'KPI edificações médias ≤ comuns');
    }

    // 4) Mapa: registros desenhados = registros filtrados
    if (ctx.mapa) {
      ok(ctx.mapa.comuns === filtrado.comuns.length, `Mapa: ${ctx.mapa.comuns} edificações comuns desenhadas`);
      ok(ctx.mapa.impacto === filtrado.impacto.length, `Mapa: ${ctx.mapa.impacto} empreendimentos desenhados`);
    }

    // 5) Gráficos: sem seleção própria, a soma das categorias = universo (contagem ou soma da métrica)
    if (ctx.graficos) {
      Object.entries(ctx.graficos).forEach(([id, g]) => {
        if (!g || g.multivalorado) return;
        const univ = FE.filtrar(dados, s, g.dim);
        const met = g.metrica || 'n';
        const soma = l => met === 'n' ? l.length : l.reduce((a, r) => a + (r[met] === null ? 0 : r[met]), 0);
        const listas = {
          impacto: univ.impacto, comuns: univ.comuns,
          medias: univ.comuns.filter(r => r.media), demais: univ.comuns.filter(r => !r.media),
          grupos: univ.comuns.concat(univ.impacto)
        };
        Object.entries(g.porSerie).forEach(([serie, mapa]) => {
          if (!listas[serie]) return;
          const esperado = soma(listas[serie]);
          const obtido = Object.values(mapa).reduce((a, b) => a + b, 0);
          ok(igual(obtido, esperado), `Gráfico ${id} (${serie}, ${met === 'n' ? 'registros' : met}): ${obtido} = ${esperado}`);
        });
      });
    }

    // 5b) Comparativo comuns × médias × impacto: grupos somam o universo filtrado
    if (ctx.comparativo) {
      const c = ctx.comparativo;
      ok(c.comuns.n === filtrado.comuns.length && c.impacto.n === filtrado.impacto.length &&
        c.demais.n + c.medias.n === c.comuns.n, 'Comparativo: comuns = demais + médias; impacto = filtrado');
      FE.VARS.forEach(v => ok(igual(c.demais[v] + c.medias[v], c.comuns[v]), `Comparativo: ${v} demais + médias = comuns`));
    }

    // 6) KDE: pontos usados = edificações comuns filtradas; massa conservada
    if (ctx.kde) {
      ok(ctx.kde.n === filtrado.comuns.length, `Densidade calculada com ${ctx.kde.n} edificações (filtradas: ${filtrado.comuns.length})`);
    }

    const falhas = R.filter(r => !r.ok);
    if (falhas.length && typeof console !== 'undefined') console.warn('[Consistência] divergências:', falhas);
    return { total: R.length, falhas: falhas.length, itens: R };
  }

  const Validation = { verificar };
  root.Validation = Validation;
  if (typeof module !== 'undefined' && module.exports) module.exports = Validation;
})(typeof window !== 'undefined' ? window : globalThis);
