/**
 * app.js — Inicialização e orquestração.
 * Fluxo único: componente pede alteração ao estado -> estado notifica (agrupado) -> atualizar()
 * recalcula o universo filtrado UMA vez e redesenha mapa, KDE, gráficos, KPIs e painéis.
 */
(function (root) {
  'use strict';
  const { CONFIG, DataLoader, FilterState, FilterEngine: FE, KDE, MapView, ChartsView, SidebarView, PanelsView, Validation, Util } = root;

  const state = new FilterState();
  root.painel = { state }; // acesso para testes/depuração

  async function iniciar() {
    const carregando = document.getElementById('carregando');
    let dados;
    try {
      dados = await DataLoader.carregar();
    } catch (err) {
      carregando.innerHTML = `<div class="erro-box"><b>Não foi possível carregar os dados.</b><br>${Util.esc(err.message)}</div>`;
      console.error(err);
      return;
    }
    root.painel.dados = dados;

    const mapa = new MapView('map');
    mapa.renderRegionais(dados.regional);
    mapa.visaoInicial();

    // KDE: extensão = limites de BH + margem do raio máximo
    const b = mapa.limitesBH;
    const mg = CONFIG.kde.raioMax / 100000 + 0.01;
    const kde = new KDE(root.proj4, { south: b.getSouth() - mg, north: b.getNorth() + mg, west: b.getWest() - mg, east: b.getEast() + mg }, CONFIG.epsgUTM);
    let raio = CONFIG.kde.raioPadrao;
    let supAtual = null, kdeSujo = true;

    const graficos = new ChartsView(state); graficos.iniciar(dados);
    const lateral = new SidebarView(state); lateral.iniciar(dados);
    const paineis = new PanelsView(state); paineis.iniciar(dados);
    let modoContexto = false;
    let filtradoAtual = null;

    Object.assign(root.painel, { mapa, kde, graficos, paineis, FE });

    // ---- Interações do mapa -> estado ----
    mapa.onRegional = nome => state.toggle('regional', nome);
    mapa.onCompararEmpreendimento = uid => state.setEmpreendimento(uid);

    // ---- Controles de camada (somente visuais) ----
    [['regional', 'Regional'], ['comuns', 'Comuns'], ['impacto', 'Impacto'], ['kde', 'Kde']].forEach(([k, s]) => {
      document.getElementById('chk' + s).addEventListener('change', e => {
        mapa.setVisivel(k, e.target.checked);
        if (k === 'kde' && e.target.checked) atualizarKDE();
        document.getElementById('kdeLegenda').hidden = !(mapa.cfg.kde.visivel);
      });
      const op = document.getElementById('op' + s);
      op.addEventListener('input', e => {
        mapa.setOpacidade(k, Number(e.target.value));
        op.nextElementSibling.textContent = Math.round(e.target.value * 100) + '%';
      });
    });
    const sRaio = document.getElementById('raioKde');
    sRaio.min = CONFIG.kde.raioMin; sRaio.max = CONFIG.kde.raioMax; sRaio.step = CONFIG.kde.passo; sRaio.value = raio;
    const lRaio = document.getElementById('raioValor');
    lRaio.textContent = Util.fmt(raio) + ' m';
    const aplicarRaio = Util.debounce(() => { kdeSujo = true; atualizarKDE(); }, 220);
    sRaio.addEventListener('input', e => { raio = Number(e.target.value); lRaio.textContent = Util.fmt(raio) + ' m'; aplicarRaio(); });
    document.getElementById('chkContexto').addEventListener('change', e => { modoContexto = e.target.checked; redesenharPontos(); });

    function atualizarKDE() {
      if (!filtradoAtual) return;
      if (!mapa.cfg.kde.visivel) { kdeSujo = true; return; }   // evita processamento com a camada desligada
      const t0 = performance.now();
      supAtual = kde.calcular(filtradoAtual.comuns, raio);
      mapa.renderKDE(supAtual);
      kdeSujo = false;
      document.getElementById('kdeMax').textContent = Util.fmt(supAtual.max, 1);
      document.getElementById('kdeInfo').textContent =
        `${Util.fmt(supAtual.n)} edificações · raio ${Util.fmt(raio)} m · célula ${supAtual.cel} m · ${Math.round(performance.now() - t0)} ms`;
      root.painel.ultimaKDE = supAtual;
    }

    function redesenharPontos() {
      const ctx = modoContexto ? dados.todos.filter(r => !filtradoAtual.uids.has(r.uid)) : null;
      return mapa.renderPontos(filtradoAtual, ctx);
    }

    // ---- Botões globais ----
    const limparTudo = () => { state.limparTudo(); document.getElementById('bairroBusca').value = ''; document.getElementById('empBusca').value = ''; };
    document.querySelectorAll('[data-limpar-tudo]').forEach(b => b.addEventListener('click', limparTudo));
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-limpar-dim]');
      if (b) { e.preventDefault(); e.stopPropagation(); state.limpar(b.dataset.limparDim); }
    });
    document.getElementById('escala').addEventListener('change', e => { graficos.escala = e.target.value; atualizar(new Set(['escala'])); });
    document.getElementById('ordBairro').addEventListener('change', e => { graficos.ordBairro = e.target.value; atualizar(new Set(['ordem'])); });
    document.getElementById('metGrupo').addEventListener('change', e => { graficos.metGrupo = e.target.value; atualizar(new Set(['metrica'])); });

    // ---- Relatório PDF (dados em tela) ----
    document.getElementById('refDados').textContent = CONFIG.referenciaDados;
    const btnPdf = document.getElementById('btnRelatorio');
    btnPdf.addEventListener('click', async () => {
      const rot = btnPdf.innerHTML;
      btnPdf.disabled = true; btnPdf.innerHTML = '⏳ Gerando relatório…';
      try {
        const r = await root.ReportPDF.gerar({ dados, state, mapa, graficos });
        root.painel.ultimoRelatorio = { nome: r.nome, paginas: r.paginas, bytes: r.bytes.length };
        root.ReportPDF.baixar(r.bytes, r.nome);
      } catch (err) {
        console.error(err);
        alert('Não foi possível gerar o relatório: ' + err.message);
      } finally { btnPdf.disabled = false; btnPdf.innerHTML = rot; }
    });

    // ---- Atualização central ----
    function atualizar(mudou) {
      const s = state.get();
      const f = FE.filtrar(dados, s);
      f.uids = new Set(f.comuns.concat(f.impacto).map(r => r.uid));
      filtradoAtual = f;

      const desenhado = redesenharPontos();
      mapa.marcarRegionais(f.emp ? new Set() : s.regional);
      kdeSujo = true; atualizarKDE();
      const g = graficos.atualizar(s);
      const k = paineis.kpis(f);
      paineis.chips(s);
      paineis.comparacao(s);
      const comp = paineis.comparativoComuns(f);
      lateral.sincronizar(s);

      const res = Validation.verificar({
        dados, s, filtrado: f, kpis: k, mapa: desenhado, graficos: g, comparativo: comp,
        kde: mapa.cfg.kde.visivel && supAtual ? { n: supAtual.n } : null
      });
      root.painel.ultimaValidacao = res;

      // Enquadramento automático do mapa
      if (mudou.has('*')) mapa.visaoInicial();
      else if (mudou.has('empreendimento') && f.emp) mapa.ajustar([f.emp, ...f.comuns]);
      else if (mudou.has('empreendimento') || mudou.has('regional') || mudou.has('bairro')) {
        if (!s.regional.size && !s.bairro.size && !f.emp) mapa.visaoInicial();
        else if (s.bairro.size || f.emp) mapa.ajustar(f.comuns.concat(f.impacto));
        else mapa.ajustar(null, s.regional);
      }
    }

    state.subscribe(atualizar);
    atualizar(new Set(['inicio']));
    carregando.hidden = true;
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})(window);
