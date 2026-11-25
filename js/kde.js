/**
 * kde.js
 * Estimativa de Densidade Kernel (KDE) com kernel quártico (biweight) — o mesmo padrão do QGIS.
 *
 * Precisão geográfica: a grade de saída é alinhada ao mapa (lat/lng, para sobrepor sem distorção),
 * mas TODAS as distâncias são calculadas em metros no SRC SIRGAS 2000 / UTM 23S (EPSG:31983):
 * cada pixel tem suas coordenadas UTM pré-calculadas (com proj4) e o raio é aplicado em metros.
 *
 * Unidade do resultado: edificações por km².
 *   K(d) = 3 / (π r²) · (1 − d²/r²)²,  para d < r   (integral = 1 por ponto)
 *
 * Desempenho: as coordenadas UTM da grade ficam em cache por tamanho de célula, e cada superfície
 * calculada fica em cache por (raio, conjunto de pontos). Trocar só a opacidade ou o mapa de fundo
 * não recalcula nada.
 */
(function (root) {
  'use strict';

  function hashTexto(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  class KDE {
    /** @param extensao {south, west, north, east} em graus; @param epsgUTM código registrado no proj4 */
    constructor(proj4, extensao, epsgUTM) {
      this.proj4 = proj4;
      this.ext = extensao;
      this.epsg = epsgUTM;
      this.cacheGrade = new Map();
      this.cacheSup = new Map();
      this.latRef = (extensao.south + extensao.north) / 2;
    }

    static tamanhoCelula(raio) {
      const c = Math.round(Math.min(120, Math.max(20, raio / 8)) / 5) * 5;
      return c;
    }

    grade(cel) {
      if (this.cacheGrade.has(cel)) return this.cacheGrade.get(cel);
      const e = this.ext;
      const dLat = cel / 110574;                                           // m por grau de latitude
      const dLng = cel / (111320 * Math.cos(this.latRef * Math.PI / 180)); // m por grau de longitude
      const nx = Math.ceil((e.east - e.west) / dLng);
      const ny = Math.ceil((e.north - e.south) / dLat);
      const X = new Float64Array(nx * ny), Y = new Float64Array(nx * ny);

      // Projeção exata numa malha grossa + interpolação bilinear (erro sub-métrico nesta escala)
      const passo = 8;
      const gx = Math.ceil(nx / passo) + 1, gy = Math.ceil(ny / passo) + 1;
      const GX = new Float64Array(gx * gy), GY = new Float64Array(gx * gy);
      for (let j = 0; j < gy; j++) {
        for (let i = 0; i < gx; i++) {
          const lng = e.west + (i * passo + 0.5) * dLng;
          const lat = e.north - (j * passo + 0.5) * dLat;
          const [ux, uy] = this.proj4('EPSG:4326', this.epsg, [lng, lat]);
          GX[j * gx + i] = ux; GY[j * gx + i] = uy;
        }
      }
      for (let j = 0; j < ny; j++) {
        const gj = Math.min(Math.floor(j / passo), gy - 2), tj = (j - gj * passo) / passo;
        for (let i = 0; i < nx; i++) {
          const gi = Math.min(Math.floor(i / passo), gx - 2), ti = (i - gi * passo) / passo;
          const a = gj * gx + gi, b = a + 1, c = a + gx, d = c + 1;
          const k = j * nx + i;
          X[k] = (GX[a] * (1 - ti) + GX[b] * ti) * (1 - tj) + (GX[c] * (1 - ti) + GX[d] * ti) * tj;
          Y[k] = (GY[a] * (1 - ti) + GY[b] * ti) * (1 - tj) + (GY[c] * (1 - ti) + GY[d] * ti) * tj;
        }
      }
      const g = { cel, nx, ny, dLat, dLng, X, Y };
      this.cacheGrade.set(cel, g);
      return g;
    }

    /**
     * @param pontos registros com {uid, x, y, lat, lng} (x,y em UTM)
     * @param raio   raio do kernel em metros
     */
    calcular(pontos, raio) {
      const chave = raio + '|' + pontos.length + '|' + hashTexto(pontos.map(p => p.uid).join(','));
      if (this.cacheSup.has(chave)) return this.cacheSup.get(chave);

      const cel = KDE.tamanhoCelula(raio);
      const g = this.grade(cel);
      const { nx, ny, dLat, dLng, X, Y } = g;
      const dens = new Float32Array(nx * ny);
      const r2 = raio * raio;
      const w = Math.ceil(raio / cel) + 2;
      const e = this.ext;

      for (const p of pontos) {
        const ci = Math.floor((p.lng - e.west) / dLng);
        const cj = Math.floor((e.north - p.lat) / dLat);
        const i0 = Math.max(0, ci - w), i1 = Math.min(nx - 1, ci + w);
        const j0 = Math.max(0, cj - w), j1 = Math.min(ny - 1, cj + w);
        for (let j = j0; j <= j1; j++) {
          const base = j * nx;
          for (let i = i0; i <= i1; i++) {
            const k = base + i;
            const dx = X[k] - p.x, dy = Y[k] - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2) { const t = 1 - d2 / r2; dens[k] += t * t; }
          }
        }
      }
      const escala = (3 / (Math.PI * r2)) * 1e6; // por km²
      let max = 0;
      for (let k = 0; k < dens.length; k++) { dens[k] *= escala; if (dens[k] > max) max = dens[k]; }

      const sup = {
        raio, cel, nx, ny, dens, max, n: pontos.length,
        limites: [[e.north - ny * dLat, e.west], [e.north, e.west + nx * dLng]]
      };
      if (this.cacheSup.size > 12) this.cacheSup.delete(this.cacheSup.keys().next().value);
      this.cacheSup.set(chave, sup);
      return sup;
    }

    /** Integral numérica da superfície (edificações). Deve ≈ n pontos (validação). */
    integral(sup) {
      const g = this.grade(sup.cel);
      // área real de cada pixel em m² a partir das coordenadas UTM vizinhas
      let soma = 0;
      for (let j = 0; j < g.ny - 1; j++) {
        for (let i = 0; i < g.nx - 1; i++) {
          const k = j * g.nx + i;
          if (!sup.dens[k]) continue;
          const ax = g.X[k + 1] - g.X[k], ay = g.Y[k + 1] - g.Y[k];
          const bx = g.X[k + g.nx] - g.X[k], by = g.Y[k + g.nx] - g.Y[k];
          soma += sup.dens[k] * Math.abs(ax * by - ay * bx) / 1e6;
        }
      }
      return soma;
    }
  }

  root.KDE = KDE;
  if (typeof module !== 'undefined' && module.exports) module.exports = KDE;
})(typeof window !== 'undefined' ? window : globalThis);
