/**
 * map.js
 * Gerenciamento do Mapa Leaflet, Camadas, Heatmap (Kernel: Densidade de Projeto de Edificações - Geral)
 * Limites Regionais e Zoom Dinâmico
 */

class MapManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;

    // Grupos de Camadas
    this.regionalLayer = null;
    this.mediasLayer = null;
    this.impactoLayer = null;
    this.heatLayer = null;

    // Estado de Visibilidade e Opacidade
    this.layerConfig = {
      regional: { visible: true, opacity: 0.5 },
      medias: { visible: true, opacity: 0.9 },
      impacto: { visible: true, opacity: 0.9 },
      heat: { visible: true, opacity: 0.75, radius: 28, blur: 20 }
    };

    this.onSelectCallback = null;
  }

  init() {
    // Garantir definição da projeção UTM SIRGAS 2000 zona 23S para reprojeção da regional
    if (typeof proj4 !== 'undefined') {
      proj4.defs('EPSG:31983', '+proj=utm +zone=23 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
    }

    this.map = L.map(this.containerId, {
      center: [-19.9208, -43.9378],
      zoom: 12,
      zoomControl: true
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });

    const esriGrayLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    });

    const esriWorldLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    });

    osmLayer.addTo(this.map);

    L.control.layers({
      "OpenStreetMap (Padrão)": osmLayer,
      "Esri Gray (Neutro)": esriGrayLayer,
      "Esri Street (Urbano)": esriWorldLayer
    }, null, { position: 'topright' }).addTo(this.map);

    // Cria pane dedicada para as regionais abaixo dos pontos (z-index 350 vs overlayPane 400)
    this.map.createPane('regionalPane');
    this.map.getPane('regionalPane').style.zIndex = 350;

    this.regionalLayer = L.geoJSON(null, { pane: 'regionalPane' }).addTo(this.map);
    this.mediasLayer = L.layerGroup().addTo(this.map);
    this.impactoLayer = L.layerGroup().addTo(this.map);

    return this;
  }

  setSelectCallback(cb) {
    this.onSelectCallback = cb;
  }

  // Renderiza polígonos das Regionais (coordenadas já em WGS84 após processamento no data-service)
  renderRegionais(geojson) {
    if (this.regionalLayer) {
      this.map.removeLayer(this.regionalLayer);
      this.regionalLayer = null;
    }

    if (!geojson) return;

    this.regionalLayer = L.geoJSON(geojson, {
      pane: 'regionalPane',
      style: () => {
        return {
          color: '#0f2d59',
          weight: 1.8,
          dashArray: '3, 4',
          fillColor: '#3b82f6',
          fillOpacity: this.layerConfig.regional.opacity * 0.15
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const regionalName = p.nome_regional || 'NÃO INFORMADO';

        layer.bindTooltip(`<strong>Regional:</strong> ${regionalName}`, {
          sticky: true,
          direction: 'top'
        });

        layer.on({
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              weight: 2.8,
              dashArray: '',
              fillOpacity: this.layerConfig.regional.opacity * 0.3,
              color: '#0d9488'
            });
          },
          mouseout: (e) => {
            this.regionalLayer.resetStyle(e.target);
          },
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            if (this.onSelectCallback) {
              this.onSelectCallback({
                type: 'regional',
                name: regionalName
              });
            }
          }
        });
      }
    });

    if (this.layerConfig.regional.visible) {
      this.regionalLayer.addTo(this.map);
    }
  }


  // Helper universal para obter [lat, lng] seguro de features Point ou MultiPoint (WGS84 ou UTM)
  getFeatureLatLng(f) {
    if (!f || !f.geometry || !f.geometry.coordinates) return null;
    let coords = f.geometry.coordinates;
    if (f.geometry.type === 'MultiPoint' || (Array.isArray(coords) && Array.isArray(coords[0]))) {
      coords = coords[0];
    }
    if (!Array.isArray(coords) || coords.length < 2) return null;
    let [lng, lat] = coords;

    if (Math.abs(lng) > 100000 && typeof proj4 !== 'undefined') {
      [lng, lat] = proj4("EPSG:31983", "EPSG:4326", [lng, lat]);
    }

    if (lat === null || lat === undefined || lng === null || lng === undefined || isNaN(lat) || isNaN(lng)) {
      return null;
    }

    // Leaflet requer [lat, lng]
    return [lat, lng];
  }

  // Renderiza o Kernel: "Densidade de Projeto de Edificações - Geral" sobre a base edificacoes_medias_estudo_geral
  renderKernelDensidade(geralFeatures) {
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    if (!geralFeatures || geralFeatures.length === 0 || typeof L.heatLayer !== 'function') return;

    const heatPoints = [];

    geralFeatures.forEach(f => {
      let lat = null, lng = null;

      if (f.wgs84Coords) {
        [lat, lng] = f.wgs84Coords;
      } else {
        const latlng = this.getFeatureLatLng(f);
        if (latlng) [lat, lng] = latlng;
      }

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        heatPoints.push([lat, lng, 0.85]);
      }
    });

    if (heatPoints.length > 0) {
      this.heatLayer = L.heatLayer(heatPoints, {
        radius: this.layerConfig.heat.radius,
        blur: this.layerConfig.heat.blur,
        maxZoom: 15,
        max: 1.0,
        minOpacity: this.layerConfig.heat.opacity * 0.35,
        gradient: {
          0.2: '#3b82f6',
          0.4: '#06b6d4',
          0.6: '#10b981',
          0.8: '#f59e0b',
          1.0: '#ef4444'
        }
      });

      if (this.layerConfig.heat.visible) {
        this.heatLayer.addTo(this.map);
      }
    }
  }

  // Renderiza Edificações Médias (_estudo)
  renderEdificacoesMedias(features) {
    this.mediasLayer.clearLayers();

    features.forEach(f => {
      const latlng = this.getFeatureLatLng(f);
      if (!latlng) return;

      const [lat, lng] = latlng;
      const p = f.properties;

      const marker = L.circleMarker([lat, lng], {
        radius: 6.5,
        fillColor: '#2563eb',
        color: '#ffffff',
        weight: 1.5,
        opacity: this.layerConfig.medias.opacity,
        fillOpacity: this.layerConfig.medias.opacity
      });

      const popupContent = `
        <div class="custom-popup">
          <div class="popup-title">🏢 Edificação Média (Estudo)</div>
          <table class="popup-table">
            <tr><td class="label">ID Requerimento:</td><td class="val">${p.id_req || 'N/I'}</td></tr>
            <tr><td class="label">Título Projeto:</td><td class="val">${p.titulo_projeto || 'N/I'}</td></tr>
            <tr><td class="label">Uso do Projeto:</td><td class="val">${p.uso_projeto || 'N/I'}</td></tr>
            <tr><td class="label">Regional:</td><td class="val">${p.nome_regional || 'N/I'}</td></tr>
            <tr><td class="label">Bairro:</td><td class="val">${p.bairro || 'N/I'}</td></tr>
            <tr><td class="label">Situação Alvará:</td><td class="val"><span class="badge badge-medium">${p.situacao_alvara || 'Ativo'}</span></td></tr>
            <tr><td class="label">Nº Unidades Res.:</td><td class="val"><strong>${p.num_und_residenciais}</strong></td></tr>
            <tr><td class="label">Área Construída:</td><td class="val">${Number(p.area_construida).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²</td></tr>
            <tr><td class="label">Total de Vagas:</td><td class="val"><strong>${p.total_vagas}</strong></td></tr>
            <tr><td class="label">População Estimada:</td><td class="val"><strong>${Number(p.pop_estimada).toLocaleString('pt-BR')} hab.</strong></td></tr>
          </table>
        </div>
      `;

      marker.bindPopup(popupContent);

      this.mediasLayer.addLayer(marker);
    });
  }

  // Renderiza Empreendimentos de Impacto (_estudo)
  renderEmpreendimentosImpacto(features) {
    this.impactoLayer.clearLayers();

    features.forEach(f => {
      const latlng = this.getFeatureLatLng(f);
      if (!latlng) return;

      const [lat, lng] = latlng;
      const p = f.properties;

      const marker = L.circleMarker([lat, lng], {
        radius: 9.5,
        fillColor: '#dc2626',
        color: '#ffffff',
        weight: 2,
        opacity: this.layerConfig.impacto.opacity,
        fillOpacity: this.layerConfig.impacto.opacity
      });

      const enquadramentoDisplay = (p.enquadramento_lista && p.enquadramento_lista.length > 0)
        ? p.enquadramento_lista.join('<br>&bull; ')
        : (p.enquadramento || 'N/I');

      const popupContent = `
        <div class="custom-popup">
          <div class="popup-title">⚠️ Empreendimento de Impacto (Estudo)</div>
          <table class="popup-table">
            <tr><td class="label">ID:</td><td class="val">${p.id || 'N/I'}</td></tr>
            <tr><td class="label">Empreendimento:</td><td class="val"><strong>${p.empreendimento}</strong></td></tr>
            <tr><td class="label">Regional:</td><td class="val">${p.nome_regional || 'N/I'}</td></tr>
            <tr><td class="label">Bairro:</td><td class="val">${p.bairro || 'N/I'}</td></tr>
            <tr><td class="label">Ano PLU:</td><td class="val">${p.ano_plu || 'N/I'}</td></tr>
            <tr><td class="label">Nº Unidades Res.:</td><td class="val"><strong>${p.num_und_residencial}</strong></td></tr>
            <tr><td class="label">Total de Vagas:</td><td class="val"><strong>${p.total_vagas}</strong></td></tr>
            <tr><td class="label">População Estimada:</td><td class="val"><strong>${Number(p.pop_estimada).toLocaleString('pt-BR')} hab.</strong></td></tr>
            <tr><td class="label">Enquadramento:</td><td class="val" style="font-size:0.72rem;">&bull; ${enquadramentoDisplay}</td></tr>
          </table>
        </div>
      `;

      marker.bindPopup(popupContent);

      this.impactoLayer.addLayer(marker);
    });
  }

  // Zoom no mapa de acordo com os pontos filtrados
  fitToBoundsFiltered(medias, impacto, targetRegionalName) {
    // Se for uma regional específica e tivermos a camada de regionais carregada
    if (targetRegionalName && targetRegionalName !== 'TODAS' && this.regionalLayer) {
      let regionalBounds = null;
      this.regionalLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties && layer.feature.properties.nome_regional === targetRegionalName) {
          regionalBounds = layer.getBounds();
        }
      });
      if (regionalBounds) {
        this.map.fitBounds(regionalBounds, { padding: [30, 30], maxZoom: 14 });
        return;
      }
    }

    const latlngs = [];

    medias.forEach(f => {
      const latlng = this.getFeatureLatLng(f);
      if (latlng) latlngs.push(latlng);
    });

    impacto.forEach(f => {
      const latlng = this.getFeatureLatLng(f);
      if (latlng) latlngs.push(latlng);
    });

    if (latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }

  // Controle de visibilidade de camada
  toggleLayer(layerKey, isVisible) {
    this.layerConfig[layerKey].visible = isVisible;

    if (layerKey === 'regional') {
      if (isVisible) this.map.addLayer(this.regionalLayer);
      else this.map.removeLayer(this.regionalLayer);
    } else if (layerKey === 'medias') {
      if (isVisible) this.map.addLayer(this.mediasLayer);
      else this.map.removeLayer(this.mediasLayer);
    } else if (layerKey === 'impacto') {
      if (isVisible) this.map.addLayer(this.impactoLayer);
      else this.map.removeLayer(this.impactoLayer);
    } else if (layerKey === 'heat') {
      if (this.heatLayer) {
        if (isVisible) this.map.addLayer(this.heatLayer);
        else this.map.removeLayer(this.heatLayer);
      }
    }
  }

  // Controle de opacidade
  setOpacity(layerKey, opacityVal) {
    this.layerConfig[layerKey].opacity = opacityVal;

    if (layerKey === 'regional') {
      this.regionalLayer.setStyle({
        fillOpacity: opacityVal * 0.2
      });
    } else if (layerKey === 'medias') {
      this.mediasLayer.eachLayer(marker => {
        marker.setStyle({
          opacity: opacityVal,
          fillOpacity: opacityVal
        });
      });
    } else if (layerKey === 'impacto') {
      this.impactoLayer.eachLayer(marker => {
        marker.setStyle({
          opacity: opacityVal,
          fillOpacity: opacityVal
        });
      });
    } else if (layerKey === 'heat') {
      if (this.heatLayer && this.heatLayer._canvas) {
        this.heatLayer._canvas.style.opacity = opacityVal;
      }
    }
  }

  resetView() {
    this.map.setView([-19.9208, -43.9378], 12);
  }
}

window.MapManager = MapManager;
