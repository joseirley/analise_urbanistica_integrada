/**
 * report-pdf.js
 * Gera um relatório em PDF (A4) com os dados exibidos na tela, usando pdf-lib (offline, licença MIT):
 *  1. Filtros aplicados   2. Indicadores   3. Mapa (imagem da tela)   4. Tabela comparativa
 *  5. Gráficos (imagens dos gráficos em tela)   6. Notas metodológicas
 * Todos os números vêm do MESMO motor/estado usados pela tela (FilterEngine + estado global).
 */
(function (root) {
  'use strict';
  const { CONFIG, FilterEngine: FE, Util } = root;
  const V = CONFIG.variaveis;

  // ---------------- Utilidades ----------------
  const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  const TROCAS = { '≥': '>=', '≤': '<=', '✔': '', '✖': 'x', 'ⓘ': '(i)', ' ': ' ', ' ': ' ', '→': '->', '⟲': '' };
  /** Garante que o texto use apenas caracteres suportados pelas fontes padrão do PDF (WinAnsi). */
  function seguro(t) {
    return String(t === null || t === undefined ? '' : t).split('').map(c => {
      if (TROCAS[c] !== undefined) return TROCAS[c];
      const n = c.charCodeAt(0);
      if ((n >= 32 && n < 127) || (n >= 160 && n <= 255) || WIN_ANSI_EXTRA.includes(c)) return c;
      if (n === 10) return '\n';
      return '';
    }).join('');
  }
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return PDFLib.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
  const COR = { pri: rgb('#0f2d59'), txt: rgb('#0f172a'), mut: rgb('#64748b'), bd: rgb('#cbd5e1'), fundo: rgb('#f1f5f9'),
    com: rgb(CONFIG.cores.comum), med: rgb('#b45309'), medC: rgb(CONFIG.cores.media), imp: rgb(CONFIG.cores.impacto), branco: rgb('#ffffff') };

  function dataHora() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return { txt: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`,
      arq: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}` };
  }

  function carregarImagem(src) {
    return new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
  }

  /** Logo SVG -> PNG (o PDF não aceita SVG). */
  async function logoPNG() {
    try {
      const img = await carregarImagem('assets/logo-pbh.svg');
      const c = document.createElement('canvas');
      const h = 120, w = Math.round(h * (img.naturalWidth || 300) / (img.naturalHeight || 100));
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/png');
    } catch (e) { return null; }
  }

  /**
   * Captura o mapa como está na tela: mapa de fundo + densidade + polígonos e pontos.
   * Se o servidor de tiles não permitir a leitura da imagem (CORS), o mapa sai sem o fundo.
   */
  async function capturarMapa(mapa) {
    const cont = mapa.map.getContainer();
    const R = cont.getBoundingClientRect();
    const esc = 2;
    const desenhar = comFundo => {
      const c = document.createElement('canvas');
      c.width = Math.round(R.width * esc); c.height = Math.round(R.height * esc);
      const ctx = c.getContext('2d');
      ctx.scale(esc, esc);
      ctx.fillStyle = '#eef2f5'; ctx.fillRect(0, 0, R.width, R.height);
      const pintar = (el, alfa = 1) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        ctx.globalAlpha = alfa;
        ctx.drawImage(el, r.left - R.left, r.top - R.top, r.width, r.height);
        ctx.globalAlpha = 1;
      };
      if (comFundo) cont.querySelectorAll('.leaflet-tile-pane img.leaflet-tile-loaded').forEach(i => pintar(i));
      const kde = cont.querySelector('img.kde-img');
      if (kde && mapa.cfg.kde.visivel) pintar(kde, Number(getComputedStyle(kde).opacity) || 1);
      cont.querySelectorAll('.leaflet-overlay-pane canvas').forEach(cv => pintar(cv));
      return c;
    };
    let c = desenhar(true), comFundo = true;
    try { return { url: c.toDataURL('image/jpeg', 0.9), w: R.width, h: R.height, comFundo }; } catch (e) {
      c = desenhar(false); comFundo = false;
      return { url: c.toDataURL('image/jpeg', 0.9), w: R.width, h: R.height, comFundo };
    }
  }

  /**
   * Imagem do gráfico em tamanho próprio para o papel (independe da largura da tela) e com fundo branco.
   * O gráfico é redimensionado temporariamente e devolvido ao tamanho original em seguida.
   */
  async function imagemGrafico(ch, id) {
    const box = ch.canvas.parentNode;
    const css = box.style.cssText;
    const alturaAtual = box.clientHeight;
    const alt = id === 'bairro' ? Math.max(alturaAtual, 380) : (id === 'regional' || id === 'enq') ? 400 : 340;
    box.style.width = '820px'; box.style.height = alt + 'px';
    ch.resize();
    await new Promise(r => requestAnimationFrame(() => r()));
    const src = ch.canvas;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0);
    const out = { url: c.toDataURL('image/png'), w: src.clientWidth, h: src.clientHeight };
    box.style.cssText = css;
    ch.resize();
    return out;
  }

  // ---------------- Montagem do documento ----------------
  class Doc {
    constructor(pdf, fontes) {
      this.pdf = pdf; this.f = fontes;
      this.W = 595.28; this.H = 841.89; this.M = 40;
      this.paginas = [];
      this.nova();
    }
    nova() { this.pg = this.pdf.addPage([this.W, this.H]); this.paginas.push(this.pg); this.y = this.H - this.M; }
    espaco(h) { if (this.y - h < this.M + 28) this.nova(); }
    larg() { return this.W - 2 * this.M; }

    quebrar(texto, fonte, tam, max) {
      const linhas = [];
      seguro(texto).split('\n').forEach(par => {
        let l = '';
        par.split(' ').forEach(w => {
          const t = l ? l + ' ' + w : w;
          if (fonte.widthOfTextAtSize(t, tam) > max && l) { linhas.push(l); l = w; } else l = t;
        });
        linhas.push(l);
      });
      return linhas;
    }

    texto(t, { tam = 9.5, negrito = false, cor = COR.txt, x = this.M, max = this.larg(), entre = 1.35, antes = 0 } = {}) {
      const f = negrito ? this.f.b : this.f.r;
      const ls = this.quebrar(t, f, tam, max);
      this.y -= antes;
      ls.forEach(l => {
        this.espaco(tam * entre);
        this.y -= tam * entre;
        this.pg.drawText(l, { x, y: this.y + 2, size: tam, font: f, color: cor });
      });
    }

    titulo(t) {
      this.espaco(40);
      this.y -= 14;
      this.pg.drawText(seguro(t), { x: this.M, y: this.y - 12, size: 13, font: this.f.b, color: COR.pri });
      this.y -= 18;
      this.pg.drawRectangle({ x: this.M, y: this.y, width: this.larg(), height: 1.2, color: COR.pri });
      this.y -= 6;
    }

    subtitulo(t) {
      this.espaco(26);
      this.y -= 8;
      this.texto(t, { tam: 10.5, negrito: true, cor: COR.pri });
      this.y -= 2;
    }

    /** linhas: [[c1, c2, ...]]; cores: cor por coluna (opcional) */
    tabela(cab, linhas, larguras, { coresCol = [], destaqueLinha = null, tam = 8.8 } = {}) {
      const L = larguras.map(p => p * this.larg());
      const h = tam + 7;
      const desenharCab = () => {
        this.espaco(h * 2);
        this.pg.drawRectangle({ x: this.M, y: this.y - h, width: this.larg(), height: h, color: COR.pri });
        let x = this.M;
        cab.forEach((c, i) => {
          const t = seguro(c), w = this.f.b.widthOfTextAtSize(t, tam - 0.6);
          const tx = i === 0 ? x + 4 : x + L[i] - w - 4;
          this.pg.drawText(t, { x: tx, y: this.y - h + 4.5, size: tam - 0.6, font: this.f.b, color: COR.branco });
          x += L[i];
        });
        this.y -= h;
      };
      desenharCab();
      linhas.forEach((ln, k) => {
        if (this.y - h < this.M + 28) { this.nova(); desenharCab(); }
        if (ln.secao) {
          this.pg.drawRectangle({ x: this.M, y: this.y - h, width: this.larg(), height: h, color: COR.fundo });
          this.pg.drawText(seguro(ln.secao), { x: this.M + 4, y: this.y - h + 4.5, size: tam - 0.8, font: this.f.b, color: COR.mut });
          this.y -= h; return;
        }
        if (k % 2 === 1) this.pg.drawRectangle({ x: this.M, y: this.y - h, width: this.larg(), height: h, color: rgb('#f8fafc') });
        let x = this.M;
        ln.forEach((c, i) => {
          const f = i === 0 || destaqueLinha === k ? this.f.r : this.f.b;
          const t = seguro(c), w = f.widthOfTextAtSize(t, tam);
          const tx = i === 0 ? x + 4 : x + L[i] - w - 4;
          this.pg.drawText(t, { x: tx, y: this.y - h + 4.5, size: tam, font: f, color: (i > 0 && coresCol[i]) || COR.txt });
          x += L[i];
        });
        this.pg.drawRectangle({ x: this.M, y: this.y - h, width: this.larg(), height: 0.4, color: COR.bd });
        this.y -= h;
      });
      this.y -= 4;
    }

    async imagem(url, wCss, hCss, { largura = this.larg(), x = this.M, legenda = null } = {}) {
      const img = url.startsWith('data:image/png') ? await this.pdf.embedPng(url) : await this.pdf.embedJpg(url);
      const h = largura * hCss / wCss;
      this.espaco(h + (legenda ? 16 : 4));
      this.y -= h;
      this.pg.drawImage(img, { x, y: this.y, width: largura, height: h });
      this.pg.drawRectangle({ x, y: this.y, width: largura, height: h, borderColor: COR.bd, borderWidth: 0.6 });
      if (legenda) this.texto(legenda, { tam: 8, cor: COR.mut, x, max: largura, antes: 1 });
      this.y -= 4;
    }

    rodapes(ref) {
      const n = this.paginas.length;
      this.paginas.forEach((p, i) => {
        p.drawRectangle({ x: this.M, y: 30, width: this.larg(), height: 0.5, color: COR.bd });
        p.drawText(seguro(`DALU / Suplan - PBH · Dados de referência: ${ref} · Fonte: Banco de Dados Suplan (2020–2026) e Censo IBGE (2022)`),
          { x: this.M, y: 19, size: 7, font: this.f.r, color: COR.mut });
        const t = `Página ${i + 1} de ${n}`;
        p.drawText(seguro(t), { x: this.W - this.M - this.f.r.widthOfTextAtSize(t, 7.5), y: 19, size: 7.5, font: this.f.r, color: COR.mut });
      });
    }
  }

  // ---------------- Textos explicativos ----------------
  const pct = (a, b) => Util.fmtPct(FE.pct(a, b));
  /** Concordância: pl(1,'edificação','edificações') -> "1 edificação" */
  const pl = (n, sing, plur) => `${Util.fmt(n)} ${n === 1 ? sing : plur}`;

  const EXPLICA_GRAFICO = {
    grupo: m => `Compara os três grupos exclusivos (edificações comuns exceto médias, edificações médias e empreendimentos de impacto) pela métrica "${m}".`,
    regional: () => 'Quantidade de registros por regional: edificações comuns (total), das quais médias, e empreendimentos de impacto. Mostra onde se concentra cada grupo.',
    bairro: o => `Os 15 bairros com maior concentração, ordenados por ${o}. Permite identificar os bairros de maior adensamento de cada grupo.`,
    uso: () => 'Distribuição dos registros por uso (residencial, não residencial e misto), para edificações comuns e empreendimentos de impacto.',
    enq: () => 'Quantidade de empreendimentos de impacto por enquadramento (nomes uniformizados). Um empreendimento pode ter mais de um enquadramento.',
    faixa_und: () => 'Soma das unidades residenciais em cada faixa de porte, separada entre comuns (exceto médias), médias e impacto.',
    faixa_vagas: () => 'Soma das vagas em cada faixa, separada entre comuns (exceto médias), médias e impacto. A faixa 100–400 corresponde ao critério de edificação média.',
    faixa_area: () => 'Soma da área construída (m²) em cada faixa, separada entre comuns (exceto médias), médias e impacto. A faixa 6.000–20.000 m² corresponde ao critério de edificação média.',
    faixa_pop: () => 'Soma da população estimada em cada faixa, separada entre comuns (exceto médias), médias e impacto.'
  };
  const TITULO_GRAFICO = {
    grupo: 'Comparação entre grupos', regional: 'Registros por regional', bairro: 'Bairros com maior concentração (top 15)',
    uso: 'Distribuição por uso', enq: 'Enquadramento dos empreendimentos de impacto', faixa_und: 'Unidades residenciais por faixa',
    faixa_vagas: 'Vagas por faixa', faixa_area: 'Área construída (m²) por faixa', faixa_pop: 'População estimada por faixa'
  };

  // ---------------- Geração ----------------
  async function gerar({ dados, state, mapa, graficos }) {
    if (!root.PDFLib) throw new Error('Biblioteca pdf-lib não carregada (lib/pdf-lib.min.js).');
    const s = state.get();
    const f = FE.filtrar(dados, s);
    const med = f.comuns.filter(r => r.media), dem = f.comuns.filter(r => !r.media);
    const tc = FE.totais(f.comuns), tm = FE.totais(med), td = FE.totais(dem), ti = FE.totais(f.impacto);
    const ref = CONFIG.referenciaDados;
    const quando = dataHora();

    const pdf = await PDFLib.PDFDocument.create();
    pdf.setTitle('Relatório - Edificações Comuns x Empreendimentos de Impacto');
    pdf.setAuthor('DALU / Suplan - Prefeitura de Belo Horizonte');
    pdf.setSubject(`Dados de referência: ${ref}`);
    pdf.setCreator('Painel v2 - Edificações Comuns x Empreendimentos de Impacto');
    const fontes = { r: await pdf.embedFont(PDFLib.StandardFonts.Helvetica), b: await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold) };
    const D = new Doc(pdf, fontes);

    // ---- Cabeçalho ----
    const pg = D.pg;
    pg.drawRectangle({ x: 0, y: D.H - 92, width: D.W, height: 92, color: COR.pri });
    const logo = await logoPNG();
    let xt = D.M;
    if (logo) {
      const li = await pdf.embedPng(logo);
      const lh = 40, lw = lh * li.width / li.height;
      pg.drawRectangle({ x: D.M, y: D.H - 72, width: lw + 12, height: lh + 12, color: COR.branco });
      pg.drawImage(li, { x: D.M + 6, y: D.H - 66, width: lw, height: lh });
      xt = D.M + lw + 26;
    }
    const tit = seguro('Relatório – Edificações Comuns × Empreendimentos de Impacto');
    const tamTit = Math.min(14, 14 * (D.W - D.M - xt) / fontes.b.widthOfTextAtSize(tit, 14));   // ajusta à largura
    pg.drawText(tit, { x: xt, y: D.H - 38, size: tamTit, font: fontes.b, color: COR.branco });
    pg.drawText(seguro('Painel de BI geoespacial · DALU / Suplan · Prefeitura de Belo Horizonte'), { x: xt, y: D.H - 54, size: 9, font: fontes.r, color: COR.branco });
    pg.drawText(seguro(`Dados de referência: ${ref}  ·  Emitido em ${quando.txt}`), { x: xt, y: D.H - 68, size: 8.5, font: fontes.b, color: rgb('#bfdbfe') });
    D.y = D.H - 104;
    D.texto('Este relatório reproduz os dados exibidos no painel no momento da emissão, considerando os filtros e seleções ativos. ' +
      'Edificações comuns são as que não passaram pelo licenciamento de empreendimentos de impacto; edificações médias são as edificações comuns ' +
      'próximas aos limiares de impacto (vagas 100–400 OU unidades 96–300 OU área 6.000–20.000 m²).', { tam: 8.8, cor: COR.mut });

    // ---- 1. Filtros ----
    D.titulo('1. Filtros aplicados');
    const chips = [...document.querySelectorAll('#chips .chip > span')].map(e => e.textContent.trim());
    if (!chips.length) D.texto('Nenhum filtro ativo: todos os registros das bases estão considerados.');
    else chips.forEach(c => D.texto('•  ' + c, { x: D.M + 6, max: D.larg() - 6 }));

    // ---- 2. Indicadores ----
    D.titulo('2. Indicadores do universo filtrado');
    const c3 = [null, COR.com, COR.med, COR.imp];
    const linhaTot = (rot, v, casas = 0) => [rot, Util.fmt(tc[v], casas), Util.fmt(tm[v], casas), Util.fmt(ti[v], casas)];
    D.tabela(['Indicador', 'Edificações comuns (todas)', 'das quais médias', 'Empreend. de impacto'],
      [['Quantidade de registros', Util.fmt(tc.n), Util.fmt(tm.n), Util.fmt(ti.n)],
        linhaTot('Unidades residenciais', 'und'), linhaTot('Vagas', 'vagas'),
        linhaTot('Área construída (m²)', 'area', 2), linhaTot('População estimada', 'pop')],
      [0.34, 0.24, 0.18, 0.24], { coresCol: c3 });
    const semInf = FE.VARS.filter(v => ti.n - ti[v + '_inf'] > 0).map(v => `${V[v].rotulo.toLowerCase()}: ${ti.n - ti[v + '_inf']}`);
    if (semInf.length) D.texto(`Empreendimentos de impacto sem valor informado (somados como zero) — ${semInf.join('; ')}.`, { tam: 8, cor: COR.mut });

    // ---- 3. Mapa ----
    D.titulo('3. Mapa');
    const cap = await capturarMapa(mapa);
    await D.imagem(cap.url, cap.w, cap.h, {
      legenda: `Legenda: vermelho = empreendimento de impacto; azul = edificação comum; laranja = edificação média; linha tracejada = limite de regional` +
        (mapa.cfg.kde.visivel ? '; mancha colorida = densidade de edificações (azul baixa → vermelho alta)' : '') +
        `. Mapa de fundo: ${cap.comFundo ? CONFIG.mapa.fundos[mapa.fundoAtual].rotulo : 'não incluído (servidor não permite a cópia da imagem)'}.`
    });
    const txtMed = tm.n === 0 ? 'nenhuma delas média' : tm.n === 1 ? '1 delas média, em laranja' : `${Util.fmt(tm.n)} delas médias, em laranja`;
    let txtMapa = `O mapa apresenta a localização de ${pl(tc.n, 'edificação comum', 'edificações comuns')} (${txtMed}) ` +
      `e de ${pl(ti.n, 'empreendimento de impacto', 'empreendimentos de impacto')} que atendem aos filtros, sobre os limites das ${dados.regional.features.length} regionais administrativas.`;
    if (f.emp) txtMapa += ` Está selecionado o empreendimento "${f.emp.nome}" e exibidas as edificações comuns do bairro ${f.emp.bairro}.`;
    if (mapa.cfg.kde.visivel && root.painel.ultimaKDE) {
      const k = root.painel.ultimaKDE;
      txtMapa += ` A camada de densidade (kernel quártico, raio de ${Util.fmt(k.raio)} m, calculado em metros no SIRGAS 2000 / UTM 23S) mostra a concentração espacial das edificações comuns filtradas; o valor máximo é de ${Util.fmt(k.max, 1)} edificações/km².`;
    }
    const ocultas = [['regional', 'regionais'], ['comuns', 'edificações comuns'], ['impacto', 'empreendimentos de impacto']].filter(([k]) => !mapa.cfg[k].visivel).map(([, n]) => n);
    if (ocultas.length) txtMapa += ` Camadas ocultas na tela: ${ocultas.join(', ')}.`;
    D.texto(txtMapa);

    // ---- 4. Tabela comparativa ----
    D.titulo('4. Tabela comparativa: edificações comuns × médias × impacto');
    const mediaReg = (t, v) => t[v + '_inf'] ? t[v] / t[v + '_inf'] : null;
    const totG = (v) => v === 'n' ? td.n + tm.n + ti.n : td[v] + tm[v] + ti[v];
    const part = (v, t) => { const T = totG(v); return T ? Util.fmtPct((v === 'n' ? t.n : t[v]) / T * 100) : '—'; };
    const linhas = [
      { secao: 'TOTAIS' },
      ['Registros', Util.fmt(tc.n), Util.fmt(tm.n), Util.fmt(ti.n)],
      ...FE.VARS.map(v => [V[v].rotulo + (v === 'area' ? ' (m²)' : ''), Util.fmt(tc[v], v === 'area' ? 2 : 0), Util.fmt(tm[v], v === 'area' ? 2 : 0), Util.fmt(ti[v], v === 'area' ? 2 : 0)]),
      { secao: 'MÉDIA POR REGISTRO (registros com valor informado)' },
      ...FE.VARS.map(v => [V[v].rotulo, Util.fmt(mediaReg(tc, v), 1), tm.n ? Util.fmt(mediaReg(tm, v), 1) : '—', ti.n ? Util.fmt(mediaReg(ti, v), 1) : '—']),
      { secao: 'PARTICIPAÇÃO NO TOTAL (comuns exceto médias + médias + impacto = 100%)' },
      ['Registros', part('n', td) + ' (exc. médias)', part('n', tm), part('n', ti)],
      ...FE.VARS.map(v => [V[v].rotulo, part(v, td) + ' (exc. médias)', part(v, tm), part(v, ti)])
    ];
    D.tabela(['Indicador', 'Comuns (todas)', 'das quais médias', 'Impacto'], linhas, [0.34, 0.24, 0.18, 0.24], { coresCol: c3 });
    const T = v => totG(v);
    let txtCmp = tc.n + ti.n === 0 ? 'Não há registros no universo filtrado.' :
      (ti.n === 0 ? 'No universo filtrado não há empreendimentos de impacto. ' :
        `No universo filtrado, ${ti.n === 1 ? 'o empreendimento de impacto representa' : `os ${Util.fmt(ti.n)} empreendimentos de impacto representam`} ` +
        `${pct(ti.n, T('n'))} dos registros, mas ${ti.n === 1 ? 'concentra' : 'concentram'} ` +
        `${pct(ti.und, T('und'))} das unidades residenciais, ${pct(ti.vagas, T('vagas'))} das vagas, ${pct(ti.area, T('area'))} da área construída e ` +
        `${pct(ti.pop, T('pop'))} da população estimada. `) +
      (tc.n === 0 ? 'Não há edificações comuns neste universo.' :
        `${tc.n === 1 ? 'A edificação comum, que não passa' : `As ${Util.fmt(tc.n)} edificações comuns, que não passam`} pelo licenciamento de impacto, ` +
        `${tc.n === 1 ? 'responde' : 'respondem'} por ${pct(tc.und, T('und'))} das unidades e ${pct(tc.area, T('area'))} da área construída` +
        (tm.n ? `; ${tm.n === 1 ? 'a edificação média' : `as ${Util.fmt(tm.n)} edificações médias`} (${pct(tm.n, tc.n)} das comuns) ${tm.n === 1 ? 'soma' : 'somam'} ${pct(tm.und, T('und'))} das unidades e ${pct(tm.area, T('area'))} da área.`
          : '; não há edificações médias neste universo, e a comparação considera todas as edificações comuns.'));
    D.texto(txtCmp, { antes: 2 });

    const cmp = FE.comparacao(dados, s);
    if (cmp) {
      D.subtitulo(`Empreendimento selecionado × edificações comuns do bairro ${cmp.emp.bairro}`);
      D.texto(`${cmp.emp.nome} · Regional ${Util.titulo(cmp.emp.regional)} · Uso ${cmp.emp.uso || Util.NI}` +
        (cmp.emp.enq.length ? ` · Enquadramento: ${cmp.emp.enq.join('; ')}` : ''), { tam: 8.6, cor: COR.mut });
      const c = cmp.comuns;
      D.tabela(['Indicador', 'Empreendimento', 'Comuns do bairro (soma)', 'Média por edif. comum', 'Empreend. ÷ soma'],
        [['Registros', '1', Util.fmt(c.n), '—', '—'],
          ...FE.VARS.map(v => {
            const ev = cmp.emp[v], cs = v === 'area' ? 2 : 0;
            return [V[v].rotulo, ev === null ? Util.NI : Util.fmt(ev, cs), Util.fmt(c[v], cs), c.n ? Util.fmt(c[v] / c.n, 1) : '—',
              ev !== null && c[v] > 0 ? Util.fmt(ev / c[v] * 100, 1) + '%' : '—'];
          })],
        [0.26, 0.17, 0.21, 0.19, 0.17], { coresCol: [null, COR.imp] });
      D.texto(`Edificações médias no bairro (com os filtros vigentes): ${Util.fmt(cmp.medias.n)} de ${Util.fmt(c.n)}.`, { tam: 8.6, cor: COR.mut });
    }

    // ---- 5. Gráficos ----
    D.titulo('5. Gráficos');
    D.texto('Os gráficos refletem os filtros ativos. Cada gráfico considera todos os filtros, exceto o da sua própria dimensão; categorias selecionadas aparecem destacadas e as demais esmaecidas. ' +
      `Escala: ${graficos.escala === 'pct' ? '% do respectivo grupo' : 'valores absolutos, com eixo único para todos os grupos'}.`, { tam: 8.8, cor: COR.mut });
    const ordem = ['grupo', 'regional', 'bairro', 'uso', 'enq', 'faixa_und', 'faixa_vagas', 'faixa_area', 'faixa_pop'];
    const metNome = { n: 'quantidade de registros', und: 'unidades residenciais', vagas: 'vagas', area: 'área construída', pop: 'população estimada' };
    const ordNome = { comuns: 'edificações comuns', medias: 'edificações médias', impacto: 'empreendimentos de impacto' };
    for (const id of ordem) {
      const ch = graficos.charts[id];
      if (!ch) continue;
      const im = await imagemGrafico(ch, id);
      const largura = D.larg() * 0.92;
      const hImg = largura * im.h / im.w;
      D.espaco(hImg + 60);
      const sel = s[id]; // o id de cada gráfico é a própria dimensão no estado global
      D.subtitulo(TITULO_GRAFICO[id]);
      const exp = id === 'grupo' ? EXPLICA_GRAFICO.grupo(metNome[graficos.metGrupo]) : id === 'bairro' ? EXPLICA_GRAFICO.bairro(ordNome[graficos.ordBairro]) : EXPLICA_GRAFICO[id]();
      D.texto(exp + (sel && sel.size ? ` Seleção ativa neste gráfico: ${sel.size} categoria(s).` : ''), { tam: 8.6, cor: COR.mut });
      await D.imagem(im.url, im.w, im.h, { largura, x: D.M + (D.larg() - largura) / 2 });
    }

    // ---- 6. Notas ----
    D.titulo('6. Notas metodológicas');
    [
      `Bases: empreendimento_impacto_estudo_2.geojson (${dados.impacto.length} empreendimentos), edificacoes_2.geojson (${dados.comuns.length} edificações) e regional.geojson (${dados.regional.features.length} regionais), todas em SIRGAS 2000 / UTM 23S (EPSG:31983). Dados de referência: ${ref}.`,
      'Combinação de filtros: E entre dimensões diferentes e OU entre categorias da mesma dimensão. Com um limite numérico informado, registros sem o valor ficam de fora.',
      'Edificações médias: edificações comuns com vagas entre 100 e 400 OU unidades residenciais entre 96 e 300 OU área construída entre 6.000 e 20.000 m² (limites inclusivos).',
      'Enquadramento: os textos originais foram uniformizados em categorias únicas, sem alteração dos arquivos de origem.',
      'Valores não informados são somados como zero e excluídos do cálculo das médias por registro.',
      'Empreendimento selecionado: comparado com as edificações comuns do mesmo bairro (bairro inteiro, mesmo quando abrange mais de uma regional).'
    ].forEach(t => D.texto('•  ' + t, { x: D.M + 6, max: D.larg() - 6, tam: 8.6 }));

    D.rodapes(ref);
    const bytes = await pdf.save();
    return { bytes, nome: `relatorio_edificacoes_impacto_${quando.arq}.pdf`, paginas: D.paginas.length };
  }

  function baixar(bytes, nome) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  root.ReportPDF = { gerar, baixar, seguro };
})(window);
