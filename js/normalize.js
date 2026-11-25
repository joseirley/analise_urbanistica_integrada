/**
 * normalize.js
 * Funções puras de uniformização de textos e números.
 * Nunca alteram os dados originais: recebem valores e devolvem novos valores.
 */
(function (root) {
  'use strict';

  /** Remove acentos, quebras de linha e espaços duplicados; caixa alta. */
  function chave(txt) {
    if (txt === null || txt === undefined) return '';
    return String(txt)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /** Limpa espaços e quebras de linha preservando acentos/caixa originais. */
  function limpo(txt) {
    if (txt === null || txt === undefined) return '';
    return String(txt).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Converte para número. Retorna null para nulo, vazio, texto não numérico ou infinito.
   * Aceita "1.234,5" (pt-BR) e "1234.5".
   */
  function numero(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v).trim();
    if (s === '') return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /** Uniformiza uso em: Residencial | Não residencial | Misto (ou null). */
  function uso(v) {
    const k = chave(v);
    if (!k) return null;
    if (k === 'MISTO' || k.startsWith('MISTO')) return 'Misto';
    if (/^NAO[ -]?RESIDENCIAL/.test(k)) return 'Não residencial';
    if (k === 'RESIDENCIAL' || k.startsWith('RESIDENCIAL')) return 'Residencial';
    return null;
  }

  /** Regional em caixa alta sem espaços extras (preserva acento e hífen: "CENTRO-SUL"). */
  function regional(v) {
    const s = limpo(v).toUpperCase();
    return s || null;
  }

  // Categorias canônicas de enquadramento (texto legal resumido)
  const ENQ = {
    AREA: 'Edificação com mais de 20.000 m² de área total edificada',
    ESTAC: 'Edificação com área de estacionamento > 10.000 m² ou mais de 400 vagas',
    UH: 'Edificação com mais de 300 unidades habitacionais',
    SUC: 'Serviço de uso coletivo com área > 6.000 m²',
    HIPER: 'Hipermercado',
    PARC: 'Parcelamento vinculado (lote > 10.000 m² ou quarteirão > 200 m)',
    SHOW: 'Casa de shows e espetáculos',
    ESPORTE: 'Gestão de instalações de esportes'
  };

  /** Classifica um trecho de enquadramento em uma categoria canônica. */
  function categoriaEnquadramento(trecho) {
    const k = chave(trecho).replace(/^[-–•\s]+/, '').replace(/[.;\s]+$/, '');
    if (!k) return null;
    if (k.includes('PARCELAMENTO')) return { cat: ENQ.PARC, mapeado: true };
    if (k.includes('ESTACIONAMENTO')) return { cat: ENQ.ESTAC, mapeado: true };
    if (/20\.?000/.test(k) && k.includes('AREA')) return { cat: ENQ.AREA, mapeado: true };
    if (/300/.test(k) && k.includes('UNIDADES')) return { cat: ENQ.UH, mapeado: true };
    if (k.includes('USO COLETIVO')) return { cat: ENQ.SUC, mapeado: true };
    if (k.includes('HIPERMERCADO')) return { cat: ENQ.HIPER, mapeado: true };
    if (k.includes('CASA DE SHOW')) return { cat: ENQ.SHOW, mapeado: true };
    if (k.includes('INSTALACOES DE ESPORTE')) return { cat: ENQ.ESPORTE, mapeado: true };
    // Não reconhecido: mantém o texto limpo para não perder informação
    return { cat: limpo(trecho).replace(/^[-–•\s]+/, ''), mapeado: false };
  }

  /**
   * Divide o campo enquadramento (itens separados por "/") e devolve
   * a lista de categorias canônicas, sem repetição.
   */
  function enquadramentos(txt) {
    const out = [];
    const naoMapeados = [];
    if (!txt) return { lista: out, naoMapeados };
    // Separa por "/" exceto quando entre dígitos (ex.: "Lei 11.181/2019")
    String(txt).split(/(?<!\d)\/|\/(?!\d)/).forEach(parte => {
      const r = categoriaEnquadramento(parte);
      if (!r) return;
      if (!r.mapeado) naoMapeados.push(r.cat);
      if (!out.includes(r.cat)) out.push(r.cat);
    });
    return { lista: out, naoMapeados };
  }

  /** "ATIVO, ATIVO, BAIXADA" -> "ATIVO (2), BAIXADA (1)" */
  function resumoSituacao(txt) {
    if (!txt) return null;
    const cont = {};
    String(txt).split(',').map(s => limpo(s).toUpperCase()).filter(Boolean)
      .forEach(s => { cont[s] = (cont[s] || 0) + 1; });
    return Object.entries(cont).map(([s, n]) => n > 1 ? `${s} (${n})` : s).join(', ');
  }

  const Normalize = { chave, limpo, numero, uso, regional, enquadramentos, categoriaEnquadramento, resumoSituacao, ENQ };
  root.Normalize = Normalize;
  if (typeof module !== 'undefined' && module.exports) module.exports = Normalize;
})(typeof window !== 'undefined' ? window : globalThis);
