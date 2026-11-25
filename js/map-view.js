/**
 * map-view.js
 * Mapa Leaflet: mapa de fundo (Street/Satellite), regionais, edificações comuns,
 * empreendimentos de impacto, densidade (KDE) e contexto (cross-highlight).
 * Visibilidade, opacidade e mapa de fundo são puramente visuais: não alteram o estado de filtros.
 */
(function (root) {
  'use strict';
  const { CONFIG, Util } = root;
  const C = CONFIG.cores;

  // Rampa de cores da densidade (baixa -> alta)
  const RAMPA = [
    [0.00, [49, 130, 189]], [0.25, [6, 182, 212]], [0.50, [16, 185, 129]],
    [0.75, [245, 158, 11]], [1.00, [220, 38, 38]]
  ];
  function corRampa(t) {
    for (let i = 1; i < RAMPA.length; i++) {
      if (t <= RAMPA[i][0]) {
        const [t0, c0] = RAMPA[i - 1], [t1, c1] = RAMPA[i];
        const u = (t - t0) / (t1 - t0);
        return [0, 1, 2].map(k => Math.round(c0[k] + (c1[k] - c0[k]) * u));
      }
    }
    return RAMPA[RAMPA.length - 1][1];
  }

  class MapView {
    constructor(id) {
      this.cfg = {
        regional: { visivel: true, opacidade: 0.6 },
        comuns: { visivel: true, opacidade: 0.85 },
        impacto: { visivel: true, opacidade: 0.95 },
        kde: { visivel: false, opacidade: 0.7 }
      };
      this.map = L.map(id, { center: CONFIG.mapa.centro, zoom: CONFIG.mapa.zoom, preferCanvas: true, zoomControl: true });
      this.renderer = L.canvas({ padding: 0.3, tolerance: 4 });
      [['kdePane', 380]]
        .forEach(([n, z]) => { this.map.createPane(n); this.map.getPane(n).style.zIndex = z; });
      this.map.getPane('kdePane').style.pointerEvents = 'none';

      this._fundos();
      this.lyrRegional = null;
      this.lyrComuns = L.layerGroup().addTo(this.map);
      this.lyrImpacto = L.layerGroup().addTo(this.map);
      this.lyrContexto = L.layerGroup().addTo(this.map);
      this.lyrKDE = null;
      this.regionaisSelecionadas = new Set();
      this.contagem = { comuns: 0, impacto: 0 };
      this.onRegional = null;
      this.onCompararEmpreendimento = null;
      this._popupDelegacao();
    }

    // ---------- Mapa de fundo ----------
    _fundos() {
      const F = CONFIG.mapa.fundos;
      this.fundos = {};
      Object.entries(F).forEach(([k, f]) => { this.fundos[k] = L.tileLayer(f.url, f.opcoes); });
      this.fundoAtual = 'street';
      this.fundos.street.addTo(this.map);
      const self = this;
      const Ctl = L.Control.extend({
        options: { position: 'topright' },
        onAdd() {
          const d = L.DomUtil.create('div', 'basemap-switch leaflet-bar');
          d.innerHTML = Object.entries(F).map(([k, f]) =>
            `<button type="button" data-fundo="${k}" class="${k === 'street' ? 'ativo' : ''}" title="Mapa de fundo: ${f.rotulo}">${k === 'street' ? '🗺️' : '🛰️'} ${f.rotulo}</button>`).join('');
          L.DomEvent.disableClickPropagation(d);
          d.addEventListener('click', e => {
            const b = e.target.closest('button[data-fundo]');
            if (b) self.setFundo(b.dataset.fundo);
          });
          self._ctlFundo = d;
          return d;
        }
      });
      new Ctl().addTo(this.map);
    }

    /** Troca o mapa de fundo preservando centro/zoom e todas as camadas temáticas. */
    setFundo(k) {
      if (!this.fundos[k] || k === this.fundoAtual) return;
      this.map.removeLayer(this.fundos[this.fundoAtual]);
      this.fundos[k].addTo(this.map);
      this.fundos[k].bringToBack();
      this.fundoAtual = k;
      this._ctlFundo.querySelectorAll('button').forEach(b => b.classList.toggle('ativo', b.dataset.fundo === k));
      root.document.body.dataset.fundo = k;
    }

    // ---------- Regionais ----------
    renderRegionais(gj) {
      // Mesmo canvas dos pontos (desenhado ao fundo): permite clicar nos polígonos e nos pontos
      this.lyrRegional = L.geoJSON(gj, {
        renderer: this.renderer,
        style: f => this._estiloRegional(f),
        onEachFeature: (f, l) => {
          l.bindTooltip(`<strong>Regional ${Util.esc(Util.titulo(f.properties.nome_regional))}</strong><br><small>Clique para filtrar</small>`, { sticky: true });
          l.on('mouseover', () => l.setStyle({ weight: 3 }));
          l.on('mouseout', () => l.setStyle(this._estiloRegional(f)));
          l.on('click', e => { L.DomEvent.stopPropagation(e); if (this.onRegional) this.onRegional(f.properties.nome_regional); });
        }
      });
      if (this.cfg.regional.visivel) this.lyrRegional.addTo(this.map);
      this.limitesBH = this.lyrRegional.getBounds();
    }

    _estiloRegional(f) {
      const o = this.cfg.regional.opacidade;
      const sel = this.regionaisSelecionadas.has(f.properties.nome_regional);
      const algum = this.regionaisSelecionadas.size > 0;
      return {
        color: sel ? '#0d9488' : C.regional, weight: sel ? 3 : 1.6, dashArray: sel ? null : '4 4',
        opacity: o, fillColor: sel ? '#14b8a6' : '#3b82f6',
        fillOpacity: o * (sel ? 0.22 : (algum ? 0.03 : 0.08))
      };
    }

    marcarRegionais(set) {
      this.regionaisSelecionadas = new Set(set);
      if (this.lyrRegional) this.lyrRegional.setStyle(f => this._estiloRegional(f));
    }

    // ---------- Pontos ----------
    _agrupar(lista) {
      const g = new Map();
      for (const r of lista) {
        const k = r.lat.toFixed(6) + ',' + r.lng.toFixed(6);
        if (!g.has(k)) g.set(k, []);
        g.get(k).push(r);
      }
      return [...g.values()];
    }

    /**
     * Redesenha os pontos do universo filtrado.
     * @param contexto lista de registros fora do filtro (cross-highlight) ou null
     */
    renderPontos(filtrado, contexto) {
      this.lyrComuns.clearLayers(); this.lyrImpacto.clearLayers(); this.lyrContexto.clearLayers();
      let nc = 0, ni = 0;
      const oc = this.cfg.comuns.opacidade, oi = this.cfg.impacto.opacidade;

      // Contexto primeiro (fica abaixo dos pontos coloridos no canvas)
      if (contexto && contexto.length) {
        contexto.forEach(r => {
          L.circleMarker([r.lat, r.lng], {
            renderer: this.renderer, interactive: false,
            radius: r.tipo === 'impacto' ? 6 : 3, weight: 0, fillColor: C.contexto, fillOpacity: 0.35
          }).addTo(this.lyrContexto);
        });
      }

      this._agrupar(filtrado.comuns).forEach(grp => {
        const temMedia = grp.some(r => r.media);
        const m = L.circleMarker([grp[0].lat, grp[0].lng], {
          renderer: this.renderer,
          radius: grp.length > 1 ? 6 : 4.5, weight: grp.length > 1 ? 2 : 1,
          color: temMedia ? '#92400e' : '#ffffff', fillColor: temMedia ? C.media : C.comum,
          opacity: oc, fillOpacity: oc
        });
        m._grp = grp; m._camada = 'comuns';
        m.bindPopup(() => this._popup(grp, 0), { maxWidth: 340, minWidth: 260 });
        this.lyrComuns.addLayer(m); nc += grp.length;
      });

      this._agrupar(filtrado.impacto).forEach(grp => {
        const m = L.circleMarker([grp[0].lat, grp[0].lng], {
          renderer: this.renderer,
          radius: 9, weight: 2.2, color: '#ffffff', fillColor: C.impacto, opacity: oi, fillOpacity: oi
        });
        m._grp = grp; m._camada = 'impacto';
        m.bindPopup(() => this._popup(grp, 0), { maxWidth: 360, minWidth: 280 });
        m.bindTooltip(Util.esc(grp[0].nome), { direction: 'top', offset: [0, -8] });
        this.lyrImpacto.addLayer(m); ni += grp.length;
      });

      this.contagem = { comuns: nc, impacto: ni };
      return this.contagem;
    }

    // ---------- Tooltip/Popup ----------
    _popup(grp, idx) {
      const r = grp[idx];
      const V = CONFIG.variaveis;
      const imp = r.tipo === 'impacto';
      const linha = (l, v) => `<tr><td class="lb">${l}</td><td class="vl">${v}</td></tr>`;
      const valor = (v, k) => r[k] === null ? `<span class="ni">${Util.NI}</span>` : `${Util.fmt(r[k], V[k].casas)}${k === 'area' ? ' m²' : ''}`;
      const nav = grp.length > 1 ? `<div class="pp-nav">
          <button type="button" data-pp="prev" ${idx === 0 ? 'disabled' : ''}>‹</button>
          <span>Registro ${idx + 1} de ${grp.length} neste local</span>
          <button type="button" data-pp="next" ${idx === grp.length - 1 ? 'disabled' : ''}>›</button></div>` : '';
      const badge = imp ? '<span class="tag tag-imp">Empreendimento de impacto</span>'
        : (r.media ? '<span class="tag tag-com">Edificação comum</span> <span class="tag tag-med">Média – próxima aos limiares</span>'
          : '<span class="tag tag-com">Edificação comum</span>');
      let html = `<div class="pp" data-grp="${Util.esc(grp.map(g => g.uid).join('|'))}" data-idx="${idx}">
        ${nav}<div class="pp-tags">${badge}</div>
        <div class="pp-tit">${imp ? Util.esc(r.nome || Util.NI) : 'Requerimento ' + Util.esc(r.id)}</div>
        <table>
          ${imp ? linha('Nome', Util.esc(r.nome || Util.NI)) : ''}
          ${linha('Regional', Util.esc(r.regional ? Util.titulo(r.regional) : Util.NI))}
          ${linha('Bairro', Util.esc(r.bairro || Util.NI))}
          ${linha(V.und.rotulo, valor(r.und, 'und'))}
          ${linha(V.vagas.rotulo, valor(r.vagas, 'vagas'))}
          ${linha('Área construída', valor(r.area, 'area'))}
          ${linha(V.pop.rotulo, valor(r.pop, 'pop'))}
          ${linha('Uso', Util.esc(r.uso || Util.NI))}
          ${imp ? linha('Enquadramento', r.enq.length ? '<ul>' + r.enq.map(e => `<li>${Util.esc(e)}</li>`).join('') + '</ul>' : Util.NI) : ''}
          ${imp && r.extras.ano ? linha('Ano do PLU', r.extras.ano) : ''}
          ${!imp && r.extras.situacao ? linha('Situação do alvará', Util.esc(r.extras.situacao)) : ''}
        </table>
        ${imp && r.extras.observacao ? `<div class="pp-obs">ⓘ ${Util.esc(r.extras.observacao)}</div>` : ''}
        ${imp ? `<button type="button" class="pp-btn" data-comparar="${Util.esc(r.uid)}">Comparar com edificações do bairro</button>` : ''}
      </div>`;
      return html;
    }

    _popupDelegacao() {
      this.map.getContainer().addEventListener('click', e => {
        const nav = e.target.closest('[data-pp]');
        if (nav) {
          const box = nav.closest('.pp');
          const pop = this.map._popup;
          if (!pop || !pop._source || !pop._source._grp) return;
          const grp = pop._source._grp;
          let idx = Number(box.dataset.idx) + (nav.dataset.pp === 'next' ? 1 : -1);
          idx = Math.max(0, Math.min(grp.length - 1, idx));
          pop.setContent(this._popup(grp, idx));
          return;
        }
        const cmp = e.target.closest('[data-comparar]');
        if (cmp && this.onCompararEmpreendimento) { this.map.closePopup(); this.onCompararEmpreendimento(cmp.dataset.comparar); }
      });
    }

    // ---------- KDE ----------
    renderKDE(sup) {
      if (this.lyrKDE) { this.map.removeLayer(this.lyrKDE); this.lyrKDE = null; }
      this.supAtual = sup;
      if (!sup || sup.max <= 0) return;
      const cv = root.document.createElement('canvas');
      cv.width = sup.nx; cv.height = sup.ny;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(sup.nx, sup.ny);
      const limiar = 0.02;
      for (let k = 0; k < sup.dens.length; k++) {
        const t = sup.dens[k] / sup.max;
        if (t <= limiar) continue;
        const [r, g, b] = corRampa(t);
        const o = k * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b;
        img.data[o + 3] = Math.round(255 * Math.min(1, 0.35 + 0.65 * t));
      }
      ctx.putImageData(img, 0, 0);
      this.lyrKDE = L.imageOverlay(cv.toDataURL(), sup.limites, {
        pane: 'kdePane', opacity: this.cfg.kde.opacidade, interactive: false, className: 'kde-img'
      });
      if (this.cfg.kde.visivel) this.lyrKDE.addTo(this.map);
    }

    // ---------- Controles de camada ----------
    _camada(k) {
      return { regional: this.lyrRegional, comuns: this.lyrComuns, impacto: this.lyrImpacto, kde: this.lyrKDE }[k];
    }

    setVisivel(k, v) {
      this.cfg[k].visivel = v;
      const l = this._camada(k);
      if (!l) return;
      if (v) l.addTo(this.map); else this.map.removeLayer(l);
      if (k === 'regional' && v) l.bringToBack();     // polígonos sempre abaixo dos pontos
      if (k === 'comuns' || k === 'impacto') { // contexto acompanha
        if (!this.cfg.comuns.visivel && !this.cfg.impacto.visivel) this.map.removeLayer(this.lyrContexto);
        else this.lyrContexto.addTo(this.map);
      }
    }

    setOpacidade(k, o) {
      this.cfg[k].opacidade = o;
      if (k === 'regional' && this.lyrRegional) this.lyrRegional.setStyle(f => this._estiloRegional(f));
      if (k === 'comuns') this.lyrComuns.eachLayer(m => m.setStyle({ opacity: o, fillOpacity: o }));
      if (k === 'impacto') this.lyrImpacto.eachLayer(m => m.setStyle({ opacity: o, fillOpacity: o }));
      if (k === 'kde' && this.lyrKDE) this.lyrKDE.setOpacity(o);
    }

    // ---------- Enquadramento ----------
    /** fitBounds seguro: se houver animação de zoom em curso, aplica ao término (evita enquadramento perdido). */
    _fit(b, op) {
      const m = this.map;
      if (m._animatingZoom) m.once('zoomend', () => m.fitBounds(b, op));
      else m.fitBounds(b, op);
    }

    ajustar(registros, nomesRegionais) {
      if (nomesRegionais && nomesRegionais.size && this.lyrRegional) {
        let b = null;
        this.lyrRegional.eachLayer(l => {
          if (nomesRegionais.has(l.feature.properties.nome_regional)) b = b ? b.extend(l.getBounds()) : L.latLngBounds(l.getBounds().getSouthWest(), l.getBounds().getNorthEast());
        });
        if (b) { this._fit(b, { padding: [24, 24], maxZoom: 15 }); return; }
      }
      if (registros && registros.length) {
        const b = L.latLngBounds(registros.map(r => [r.lat, r.lng]));
        this._fit(b, { padding: [40, 40], maxZoom: 16 });
      }
    }

    visaoInicial() {
      if (this.limitesBH) this._fit(this.limitesBH, { padding: [10, 10] });
      else this.map.setView(CONFIG.mapa.centro, CONFIG.mapa.zoom);
    }
  }

  MapView.corRampa = corRampa;
  root.MapView = MapView;
})(window);
