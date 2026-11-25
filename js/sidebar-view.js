/**
 * sidebar-view.js
 * Filtros laterais. Cada controle apenas altera o estado global; a exibição é
 * ressincronizada a partir do estado a cada atualização (sem ciclos de eventos).
 * As contagens ao lado das opções consideram os demais filtros ativos.
 */
(function (root) {
  'use strict';
  const { CONFIG, FilterEngine: FE, Util } = root;

  class SidebarView {
    constructor(state) { this.state = state; }

    iniciar(dados) {
      this.dados = dados;
      const st = this.state;
      this.regionais = dados.regional.features.map(f => f.properties.nome_regional).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      this.bairrosPorRegional = {};
      dados.todos.forEach(r => { (this.bairrosPorRegional[r.regional] = this.bairrosPorRegional[r.regional] || new Set()).add(r.bairro); });
      this.bairros = [...new Set(dados.todos.map(r => r.bairro))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      this.enqs = Object.keys(dados.qualidade.enquadramentoMapa).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      this.emps = dados.impacto.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

      // Listas suspensas: abrir/fechar (uma por vez), fechar ao clicar fora ou com Esc
      const fecharTodas = exceto => document.querySelectorAll('.dd.aberta').forEach(d => {
        if (d !== exceto) { d.classList.remove('aberta'); d.querySelector('.dd-pnl').hidden = true; }
      });
      document.querySelectorAll('.dd').forEach(dd => {
        dd.querySelector('.dd-btn').addEventListener('click', () => {
          const abrir = !dd.classList.contains('aberta');
          fecharTodas(dd);
          dd.classList.toggle('aberta', abrir);
          dd.querySelector('.dd-pnl').hidden = !abrir;
          if (abrir) { const b = dd.querySelector('input[type=search]'); if (b) b.focus(); }
        });
      });
      document.addEventListener('click', e => { if (!e.target.closest('.dd')) fecharTodas(null); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharTodas(null); });
      this.fecharListas = () => fecharTodas(null);

      // Listas de seleção múltipla (delegação de eventos)
      [['lstRegional', 'regional'], ['lstBairro', 'bairro'], ['lstUso', 'uso'], ['lstEnq', 'enq']].forEach(([id, dim]) => {
        document.getElementById(id).addEventListener('change', e => {
          const cb = e.target.closest('input[type=checkbox]');
          if (cb) st.toggle(dim, cb.value);
        });
      });
      document.getElementById('bairroBusca').addEventListener('input', () => this._listaBairros(st.get()));

      // Empreendimento de impacto (busca + lista)
      const busca = document.getElementById('empBusca');
      busca.addEventListener('input', () => this._listaEmp(st.get()));
      document.getElementById('empLista').addEventListener('click', e => {
        const b = e.target.closest('[data-uid]');
        if (b) { st.setEmpreendimento(st.get().empreendimento === b.dataset.uid ? null : b.dataset.uid); this.fecharListas(); }
      });
      document.getElementById('empLimpar').addEventListener('click', () => st.setEmpreendimento(null));

      // Faixas numéricas (mín./máx.)
      FE.VARS.forEach(v => {
        const mi = document.getElementById(`rg_${v}_min`), ma = document.getElementById(`rg_${v}_max`);
        const vals = dados.todos.map(r => r[v]).filter(x => x !== null);
        const lo = Math.min(...vals), hi = Math.max(...vals);
        mi.placeholder = 'mín.'; ma.placeholder = 'máx.';
        mi.title = ma.title = `Valores na base: ${Util.fmt(Math.floor(lo))} a ${Util.fmt(Math.ceil(hi))}`;
        const aplicar = Util.debounce(() => {
          let a = mi.value, b = ma.value;
          if (a !== '' && b !== '' && Number(a) > Number(b)) { [a, b] = [b, a]; mi.value = a; ma.value = b; }
          st.setRange(v, a, b);
        }, 350);
        mi.addEventListener('input', aplicar); ma.addEventListener('input', aplicar);
      });

      document.getElementById('chkMedias').addEventListener('change', e => st.setMedias(e.target.checked));
    }

    _contagens(s, dim, fnCat) {
      const u = FE.filtrar(this.dados, s, dim);
      const c = {}, i = {};
      u.comuns.forEach(r => [].concat(fnCat(r)).forEach(k => { c[k] = (c[k] || 0) + 1; }));
      u.impacto.forEach(r => [].concat(fnCat(r)).forEach(k => { i[k] = (i[k] || 0) + 1; }));
      return { c, i };
    }

    _item(dim, valor, rotulo, marcado, cont) {
      const vazio = cont && !cont.c && !cont.i;
      const badge = cont ? `<span class="cnt" title="edificações comuns · empreendimentos de impacto">${cont.c !== undefined ? Util.fmt(cont.c || 0) : ''}${cont.i !== undefined ? ' · <b>' + Util.fmt(cont.i || 0) + '</b>' : ''}</span>` : '';
      return `<label class="opt ${marcado ? 'on' : ''} ${vazio && !marcado ? 'vazio' : ''}"><input type="checkbox" value="${Util.esc(valor)}" ${marcado ? 'checked' : ''}><span class="txt">${Util.esc(rotulo)}</span>${badge}</label>`;
    }

    _listaBairros(s) {
      const termo = root.Normalize.chave(document.getElementById('bairroBusca').value);
      let base = this.bairros;
      if (s.regional.size) {
        const permit = new Set(); s.regional.forEach(rg => (this.bairrosPorRegional[rg] || []).forEach(b => permit.add(b)));
        base = base.filter(b => permit.has(b) || s.bairro.has(b));
      }
      if (termo) base = base.filter(b => root.Normalize.chave(b).includes(termo) || s.bairro.has(b));
      const { c, i } = this._contagens(s, 'bairro', r => r.bairro);
      const sel = base.filter(b => s.bairro.has(b)), resto = base.filter(b => !s.bairro.has(b));
      document.getElementById('lstBairro').innerHTML = sel.concat(resto)
        .map(b => this._item('bairro', b, b, s.bairro.has(b), { c: c[b] || 0, i: i[b] || 0 })).join('') ||
        '<div class="vazio-msg">Nenhum bairro encontrado</div>';
      document.getElementById('bairroInfo').textContent = s.regional.size ? `(${base.length} nas regionais selecionadas)` : `(${base.length})`;
    }

    _listaEmp(s) {
      const termo = root.Normalize.chave(document.getElementById('empBusca').value);
      const lista = this.emps.filter(r => !termo || root.Normalize.chave(r.nome + ' ' + r.bairro).includes(termo));
      document.getElementById('empLista').innerHTML = lista.map(r =>
        `<button type="button" class="emp-item ${s.empreendimento === r.uid ? 'on' : ''}" data-uid="${Util.esc(r.uid)}">
          <span class="emp-nome">${Util.esc(r.nome)}</span><span class="emp-bairro">${Util.esc(r.bairro)} · ${Util.esc(Util.titulo(r.regional))}</span></button>`).join('') ||
        '<div class="vazio-msg">Nenhum empreendimento encontrado</div>';
    }

    sincronizar(s) {
      const cr = this._contagens(s, 'regional', r => r.regional);
      document.getElementById('lstRegional').innerHTML = this.regionais
        .map(k => this._item('regional', k, Util.titulo(k), s.regional.has(k), { c: cr.c[k] || 0, i: cr.i[k] || 0 })).join('');
      this._listaBairros(s);
      const cu = this._contagens(s, 'uso', r => r.uso);
      document.getElementById('lstUso').innerHTML = CONFIG.usos
        .map(k => this._item('uso', k, k, s.uso.has(k), { c: cu.c[k] || 0, i: cu.i[k] || 0 })).join('');
      const ce = this._contagens(s, 'enq', r => r.tipo === 'impacto' ? r.enq : []);
      document.getElementById('lstEnq').innerHTML = this.enqs
        .map(k => this._item('enq', k, k, s.enq.has(k), { i: ce.i[k] || 0 })).join('');
      this._listaEmp(s);
      const emp = s.empreendimento ? this.dados.impacto.find(r => r.uid === s.empreendimento) : null;
      const box = document.getElementById('empSel');
      box.hidden = !emp;
      if (emp) document.getElementById('empSelNome').innerHTML =
        `<strong>${Util.esc(emp.nome)}</strong><br><small>Comparando com as edificações comuns do bairro <b>${Util.esc(emp.bairro)}</b>. Filtros de Regional/Bairro suspensos para as edificações comuns enquanto houver seleção.</small>`;
      document.querySelectorAll('.terr-lock').forEach(e => e.classList.toggle('bloqueado', !!emp));

      // Resumo exibido no botão de cada lista suspensa
      const resumo = (id, set, todos, fmt = v => v) => {
        const el = document.getElementById(id);
        el.textContent = set.size === 0 ? todos : set.size === 1 ? fmt([...set][0]) : `${set.size} selecionados`;
        el.closest('.dd').classList.toggle('com-selecao', set.size > 0);
      };
      resumo('ddRegionalTxt', s.regional, 'Todas as regionais', Util.titulo);
      resumo('ddBairroTxt', s.bairro, 'Todos os bairros');
      resumo('ddEnqTxt', s.enq, 'Todos os enquadramentos');
      document.getElementById('ddEmpTxt').textContent = emp ? emp.nome : 'Todos os empreendimentos';
      document.getElementById('ddEmp').classList.toggle('com-selecao', !!emp);
      FE.VARS.forEach(v => {
        const rg = s.range[v];
        const mi = document.getElementById(`rg_${v}_min`), ma = document.getElementById(`rg_${v}_max`);
        if (document.activeElement !== mi) mi.value = rg.min === null ? '' : rg.min;
        if (document.activeElement !== ma) ma.value = rg.max === null ? '' : rg.max;
        mi.closest('.range-row').classList.toggle('on', rg.min !== null || rg.max !== null);
      });
      document.getElementById('chkMedias').checked = s.medias;
      document.getElementById('cardMedias').classList.toggle('on', s.medias);
    }
  }

  root.SidebarView = SidebarView;
})(window);
