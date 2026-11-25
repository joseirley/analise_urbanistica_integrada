/**
 * util.js — formatação numérica pt-BR e utilidades de DOM.
 */
(function (root) {
  'use strict';
  const NI = 'Não informado';

  function fmt(v, casas = 0) {
    if (v === null || v === undefined || !Number.isFinite(v)) return NI;
    return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }
  function fmtUn(v, un, casas = 0) { return v === null || v === undefined ? NI : `${fmt(v, casas)} ${un}`; }
  function fmtPct(v, casas = 1) { return v === null || v === undefined || !Number.isFinite(v) ? '—' : fmt(v, casas) + '%'; }
  function compacto(v) {
    if (!Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
    if (a >= 1e4) return (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return fmt(v, 0);
  }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function el(tag, attrs = {}, html = '') {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
    });
    if (html) e.innerHTML = html;
    return e;
  }
  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
  function titulo(s) { // "CENTRO-SUL" -> "Centro-Sul"
    return String(s || '').toLowerCase().replace(/(^|[\s-])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase());
  }

  const Util = { NI, fmt, fmtUn, fmtPct, compacto, esc, el, debounce, titulo };
  root.Util = Util;
  if (typeof module !== 'undefined' && module.exports) module.exports = Util;
})(typeof window !== 'undefined' ? window : globalThis);
