/**
 * Compara o motor do painel (js/*.js) com a referência independente em Python (tests/referencia.json).
 * Uso:  node tests/teste_motor.js
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = p => path.join(__dirname, '..', p);
const proj4 = require(R('lib/proj4.js'));
require(R('js/config.js')); require(R('js/normalize.js'));
const DL = require(R('js/data-loader.js')), FE = require(R('js/filter-engine.js'));
const FS = require(R('js/filter-state.js')), KDE = require(R('js/kde.js')), VAL = require(R('js/validation.js'));
const CONFIG = require(R('js/config.js'));

const rd = f => JSON.parse(fs.readFileSync(R('base/' + f), 'utf-8'));
const originais = ['empreendimento_impacto_estudo_2.geojson', 'edificacoes_2.geojson', 'regional.geojson']
  .map(f => crypto.createHash('md5').update(fs.readFileSync(R('base/' + f))).digest('hex'));
const dados = DL.montar(rd('empreendimento_impacto_estudo_2.geojson'), rd('edificacoes_2.geojson'), rd('regional.geojson'), proj4);
const ref = JSON.parse(fs.readFileSync(R('tests/referencia.json'), 'utf-8'));

let ok = 0, falha = 0;
const chk = (cond, msg) => { if (cond) ok++; else { falha++; console.log('  ✖ ' + msg); } };
const perto = (a, b) => Math.abs(a - b) < 0.011;

function estadoDe(c) {
  const st = new FS(); const s = st.get();
  ['regional', 'bairro', 'uso', 'enq', 'grupo'].forEach(d => { if (c[d]) s[d] = new Set(c[d]); });
  if (c.faixa_area) s.faixa_area = new Set(c.faixa_area);
  if (c.medias) s.medias = true;
  if (c.empreendimento) s.empreendimento = c.empreendimento;
  if (c.range) Object.entries(c.range).forEach(([v, [a, b]]) => { s.range[v] = { min: a, max: b }; });
  return s;
}

console.log('== Cenários de filtro: motor JS × referência Python ==');
for (const [nome, c] of Object.entries(ref.cenarios)) {
  const s = estadoDe(c.estado);
  const f = FE.filtrar(dados, s);
  const e = c.esperado;
  const uids = f.comuns.concat(f.impacto).map(r => r.uid).sort();
  const h = crypto.createHash('md5').update(uids.join(',')).digest('hex');
  const antes = falha;
  chk(h === e.hash_uids, `${nome}: conjunto de registros difere`);
  [['comuns', 'comum'], ['impacto', 'impacto']].forEach(([g, gr]) => {
    const t = FE.totais(f[g]);
    chk(t.n === e[gr].n, `${nome}: n ${g} ${t.n} ≠ ${e[gr].n}`);
    ['und', 'vagas', 'area', 'pop'].forEach(v => chk(perto(t[v], e[gr][v]), `${nome}: ${v} ${g} ${t[v]} ≠ ${e[gr][v]}`));
  });
  chk(f.comuns.filter(r => r.media).length === e.medias, `${nome}: médias`);
  // Verificador de consistência em tempo de execução também deve passar
  const kp = { comuns: FE.totais(f.comuns), impacto: FE.totais(f.impacto), nMedias: f.comuns.filter(r => r.media).length };
  const v = VAL.verificar({ dados, s, filtrado: f, kpis: kp, mapa: { comuns: f.comuns.length, impacto: f.impacto.length } });
  chk(v.falhas === 0, `${nome}: validação em tempo de execução com ${v.falhas} falha(s)`);
  console.log(`${falha === antes ? '✔' : '✖'} ${nome.padEnd(48)} comuns=${String(f.comuns.length).padStart(5)} impacto=${String(f.impacto.length).padStart(3)}`);
}

console.log('\n== Gráfico por Regional (cross-filter exclui a própria dimensão) ==');
for (const [nome, g] of Object.entries(ref.graficos)) {
  const s = estadoDe(ref.cenarios[nome].estado);
  const u = FE.filtrar(dados, s, 'regional');
  const calc = {
    comuns: FE.contar(u.comuns, r => r.regional),
    medias: FE.contar(u.comuns.filter(r => r.media), r => r.regional),
    impacto: FE.contar(u.impacto, r => r.regional)
  };
  ['comuns', 'medias', 'impacto'].forEach(se => chk(JSON.stringify(Object.entries(calc[se]).sort()) === JSON.stringify(Object.entries(g[se] || {}).sort()), `${nome}: série ${se} difere`));
  console.log(`✔ ${nome}: ${JSON.stringify(calc.comuns)}`);
}

console.log('\n== Análise de Edificações Médias ==');
for (const [nome, e] of Object.entries(ref.medias_analise)) {
  const a = FE.analiseMedias(dados, estadoDe(ref.cenarios[nome].estado));
  chk(a.universo.n === e.universo_n && a.medias.n === e.medias_n, `${nome}: contagens`);
  ['n', 'und', 'vagas', 'area', 'pop'].forEach(v => chk(Math.abs(a.pct[v] - e['pct_' + v]) < 1e-3, `${nome}: pct ${v} ${a.pct[v]} ≠ ${e['pct_' + v]}`));
  console.log(`✔ ${nome}: ${a.medias.n}/${a.universo.n} (${a.pct.n.toFixed(2)}%)`);
}

console.log('\n== Faixas: cada registro em exatamente uma faixa ==');
['und', 'vagas', 'area', 'pop'].forEach(v => {
  const multi = dados.todos.filter(r => CONFIG.faixas[v].filter(b => b.teste(r[v])).length !== 1).length;
  chk(multi === 0, `faixa ${v}: ${multi} registros fora de exatamente 1 faixa`);
  console.log(`✔ faixa ${v}: 0 registros ambíguos`);
});

console.log('\n== KDE: conservação de massa (integral ≈ nº de edificações) e raio em metros ==');
const b = { south: -20.07, north: -19.75, west: -44.10, east: -43.83 };
const k = new KDE(proj4, b, CONFIG.epsgUTM);
for (const raio of [200, 500, 800, 1500, 3000]) {
  const sup = k.calcular(dados.comuns, raio);
  const integ = k.integral(sup);
  chk(Math.abs(integ - sup.n) / sup.n < 0.01, `KDE raio ${raio}: integral ${integ} vs ${sup.n}`);
  console.log(`✔ raio ${raio} m: integral ${integ.toFixed(1)} / ${sup.n} pontos; máx ${sup.max.toFixed(1)} edif/km²`);
}
// ponto isolado: densidade no centro = 3/(π r²) por m² e zero além do raio
{
  const p = dados.comuns[0], raio = 1000;
  const sup = k.calcular([p], raio);
  const esperado = 3 / (Math.PI * raio * raio) * 1e6;
  chk(Math.abs(sup.max - esperado) / esperado < 0.02, `KDE pico ${sup.max} ≠ ${esperado}`);
  const g = k.grade(sup.cel);
  let alem = 0;
  for (let i = 0; i < sup.dens.length; i++) if (sup.dens[i] > 0 && Math.hypot(g.X[i] - p.x, g.Y[i] - p.y) >= raio) alem++;
  chk(alem === 0, `KDE: ${alem} pixels com densidade além do raio`);
  console.log(`✔ ponto isolado: pico ${sup.max.toFixed(3)} (teórico ${esperado.toFixed(3)}) edif/km²; nenhum valor além de ${raio} m`);
}

console.log('\n== Integridade dos arquivos originais ==');
const depois = ['empreendimento_impacto_estudo_2.geojson', 'edificacoes_2.geojson', 'regional.geojson']
  .map(f => crypto.createHash('md5').update(fs.readFileSync(R('base/' + f))).digest('hex'));
chk(JSON.stringify(originais) === JSON.stringify(depois), 'arquivos de base alterados');
console.log('✔ GeoJSON originais inalterados (md5)');

console.log(`\nRESULTADO: ${ok} verificações OK, ${falha} falha(s)`);
process.exit(falha ? 1 : 0);
