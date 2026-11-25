# -*- coding: utf-8 -*-
"""
Teste de interface ponta a ponta (Playwright + Chrome), com cliques reais em gráficos, mapa e filtros.
Pré-requisito: painel servido em http://localhost:8765  (ex.: python -m http.server 8765 na pasta painel_v2)
Uso:  python tests/teste_interface.py
"""
import json, os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('PAINEL_URL', 'http://localhost:8765/index.html')
AQUI = os.path.dirname(os.path.abspath(__file__))
REF = json.load(open(os.path.join(AQUI, 'referencia.json'), encoding='utf-8'))['cenarios']
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')

res = []


def reg(ok, msg):
    res.append((ok, msg))
    print(('✔ ' if ok else '✖ ') + msg)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1700, 'height': 1000})
    erros = []
    pg.on('pageerror', lambda e: erros.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function('window.painel && window.painel.ultimaValidacao', timeout=30000)

    def esperar():
        pg.wait_for_timeout(450)

    def estado():
        return pg.evaluate('''() => { const P = window.painel, d = P.dados, s = P.state.get();
            const f = P.FE.filtrar(d, s);
            return { comuns: f.comuns.length, impacto: f.impacto.length, val: P.ultimaValidacao.falhas, nval: P.ultimaValidacao.total,
                     kc: document.getElementById('kN_comuns').textContent, ki: document.getElementById('kN_impacto').textContent,
                     mapa: P.mapa.contagem, fundo: P.mapa.fundoAtual, zoom: P.mapa.map.getZoom(), centro: P.mapa.map.getCenter(),
                     chips: document.getElementById('chips').innerText } }''')

    def confere(passo, cen=None, n=None):
        e = estado()
        if cen:
            exp = REF[cen]['esperado']
            n = (exp['comum']['n'], exp['impacto']['n'])
        kc = int(e['kc'].replace('.', ''))
        ki = int(e['ki'].replace('.', ''))
        ok = (kc, ki) == tuple(n) and (e['comuns'], e['impacto']) == tuple(n) and e['val'] == 0 \
            and e['mapa']['comuns'] == n[0] and e['mapa']['impacto'] == n[1]
        reg(ok, f"{passo}: KPI {kc}/{ki}, mapa {e['mapa']['comuns']}/{e['mapa']['impacto']}, esperado {n[0]}/{n[1]}, consistência {e['nval'] - e['val']}/{e['nval']}")
        return e

    def clicar_barra(chart, chave, ds=0):
        pos = pg.evaluate('''([id, k, ds]) => { const ch = window.painel.graficos.charts[id];
            const i = ch._keys.indexOf(k); if (i < 0) return null;
            ch.canvas.scrollIntoView({block: 'center'});
            const el = ch.getDatasetMeta(ds).data[i]; const r = ch.canvas.getBoundingClientRect();
            const h = ch.options.indexAxis === 'y';
            return { x: r.left + (h ? Math.max(el.base + 4, (el.x + el.base) / 2) : el.x), y: r.top + (h ? el.y : Math.min(el.base - 4, (el.y + el.base) / 2)) }; }''', [chart, chave, ds])
        if not pos:
            reg(False, f'categoria {chave} não encontrada no gráfico {chart}')
            return
        pg.mouse.click(pos['x'], pos['y'])
        esperar()

    def na_lista(dd, seletor, busca=None, campo=None):
        """Abre a lista suspensa, (opcionalmente) busca, clica na opção e fecha com Esc."""
        pg.click(f'#{dd} .dd-btn')
        pg.wait_for_timeout(150)
        if busca is not None:
            pg.fill(campo, busca)
            pg.wait_for_timeout(200)
        pg.click(seletor)
        esperar()
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(100)

    def limpar():
        pg.click('.btn-limpar')
        esperar()

    # 1. Carga inicial
    e = confere('01 Carga inicial (3 camadas)', 'S01_sem_filtro')
    nreg = pg.evaluate('window.painel.mapa.lyrRegional.getLayers().length')
    reg(nreg == 10, f'01b Camada regional (EPSG:31983) com {nreg} polígonos, incluindo Hipercentro')
    clicar_barra('regional', 'HIPERCENTRO')
    confere('01c Gráfico Regional → Hipercentro', 'S22_regional_hipercentro')
    pg.click('.btn-limpar'); pg.wait_for_timeout(400)

    # 2. Clique no gráfico de Regional
    clicar_barra('regional', 'CENTRO-SUL')
    confere('02 Gráfico Regional → Centro-Sul', 'S02_regional_centro_sul')
    reg('Centro-Sul' in estado()['chips'], '02b Etiqueta de filtro ativo exibida')
    # 3. + clique no gráfico de Uso (AND entre dimensões)
    clicar_barra('uso', 'Residencial')
    confere('03 + Gráfico Uso → Residencial (AND)', 'S03_centro_sul_e_residencial')
    # 4. desmarcar clicando novamente
    clicar_barra('uso', 'Residencial')
    confere('04 Clique novamente desmarca Residencial', 'S02_regional_centro_sul')
    # 5. destaque: barras não selecionadas esmaecidas
    cores = pg.evaluate("window.painel.graficos.charts.regional.data.datasets[0].backgroundColor")
    keys = pg.evaluate("window.painel.graficos.charts.regional._keys")
    i = keys.index('CENTRO-SUL')
    reg(not str(cores[i]).startswith('rgba') and all(str(c).startswith('rgba') for j, c in enumerate(cores) if j != i),
        '05 Destaque visual: selecionada em cor cheia, demais esmaecidas')
    eixos = pg.evaluate("Object.keys(window.painel.graficos.charts.uso.options.scales).sort()")
    reg(eixos == ['x', 'y'], f'05b Edificações e impacto no mesmo eixo de valores (eixos: {eixos})')
    # 6. limpar seleção individual do gráfico
    pg.click('[data-chart="regional"] [data-limpar-dim="regional"]')
    esperar()
    confere('06 Limpar seleção individual do gráfico', 'S01_sem_filtro')

    # 7. OR na mesma dimensão
    clicar_barra('regional', 'PAMPULHA')
    clicar_barra('regional', 'OESTE')
    confere('07 Pampulha OU Oeste (seleção múltipla)', 'S04_pampulha_ou_oeste')
    limpar()
    e = confere('08 Limpar filtros (global)', 'S01_sem_filtro')
    reg('Nenhum filtro ativo' in e['chips'], '08b Etiquetas zeradas')

    # 9. Filtro lateral de bairro
    na_lista('ddBairro', '#lstBairro input[value="Savassi"]', 'savassi', '#bairroBusca')
    reg(pg.inner_text('#ddBairroTxt') == 'Savassi', '09b Botão da lista suspensa mostra a seleção')
    confere('09 Filtro lateral Bairro = Savassi', 'S05_bairro_savassi')
    limpar()

    # 10. Edificações médias (checkbox) e combinação com regional
    pg.click('#chkMedias')
    esperar()
    confere('10 Edificações Médias', 'S06_medias')
    na_lista('ddRegional', '#lstRegional input[value="NORDESTE"]')
    confere('11 Médias + Regional Nordeste', 'S07_medias_nordeste')
    pg.click('#chkMedias')
    esperar()
    na_lista('ddRegional', '#lstRegional input[value="NORDESTE"]')
    confere('12 Desativar Médias retorna ao universo normal', 'S01_sem_filtro')

    # 13. Faixa numérica (mín./máx.)
    pg.fill('#rg_und_min', '96')
    pg.fill('#rg_und_max', '300')
    pg.wait_for_timeout(800)
    confere('13 Unidades residenciais 96–300', 'S08_und_96_300')
    limpar()
    pg.fill('#rg_pop_max', '500')
    pg.wait_for_timeout(800)
    confere('14 População ≤ 500 (nulos excluídos)', 'S10_pop_max_500')
    limpar()

    # 15. Enquadramento
    na_lista('ddEnq', '#lstEnq input[value^="Edificação com área de estacionamento"]')
    confere('15 Enquadramento: estacionamento/400 vagas', 'S11_enq_estacionamento')
    pg.click('#chips button[data-rm="enq"]')
    esperar()
    confere('16 Remover etiqueta de enquadramento', 'S01_sem_filtro')

    # 17. Seleção de empreendimento (lista lateral) + reversibilidade
    na_lista('ddRegional', '#lstRegional input[value="CENTRO-SUL"]')
    na_lista('ddEmp', '#empLista [data-uid="I:13"]', 'bernardo', '#empBusca')
    e = confere('17 Empreendimento I:13 → edificações do bairro Palmares', 'S12_emp_palmares_I13')
    cmp = pg.inner_text('#cmpCorpo')
    reg('Palmares' in cmp and 'Comuns do bairro' in cmp, '17b Painel comparativo com bairro identificado automaticamente')
    pg.click('#empLimpar')
    esperar()
    confere('18 Remover seleção → volta à visualização anterior (Centro-Sul)', 'S02_regional_centro_sul')
    limpar()

    # 19. Tooltip/popup via clique real no mapa + botão comparar
    pg.evaluate('document.querySelector(".mapa-box").scrollIntoView({block: "center"})')
    pg.wait_for_timeout(300)
    pos = pg.evaluate('''() => { const P = window.painel, m = P.mapa.map; const r = P.dados.impacto.find(x => x.uid === 'I:2');
        m.setView([r.lat, r.lng], 16, {animate: false}); const pt = m.latLngToContainerPoint([r.lat, r.lng]);
        const b = m.getContainer().getBoundingClientRect(); return {x: b.left + pt.x, y: b.top + pt.y}; }''')
    pg.wait_for_timeout(400)
    pg.mouse.click(pos['x'], pos['y'])
    pg.wait_for_timeout(400)
    txt = pg.inner_text('.leaflet-popup-content') if pg.query_selector('.leaflet-popup-content') else ''
    campos = ['Empreendimento de impacto', 'Regional', 'Bairro', 'Unidades residenciais', 'Vagas', 'Área construída', 'População estimada', 'Uso', 'Enquadramento', 'Não informado', 'Serra', '581', '119.605,30']
    reg(all(c in txt for c in campos), '19 Quadro do ponto (impacto) com todos os campos, "Não informado" e formatação pt-BR')
    pg.click('.pp-btn')
    esperar()
    confere('20 Botão "Comparar" do quadro seleciona o empreendimento (Serra)', 'S20_emp_serra_I2')
    limpar()

    # 21. Popup de edificação comum em local com vários registros
    pos = pg.evaluate('''() => { const P = window.painel, m = P.mapa.map; let alvo = null;
        P.mapa.lyrComuns.eachLayer(l => { if (!alvo && l._grp.length > 2) alvo = l; });
        m.setView(alvo.getLatLng(), 18, {animate: false}); const pt = m.latLngToContainerPoint(alvo.getLatLng());
        const b = m.getContainer().getBoundingClientRect(); return {x: b.left + pt.x, y: b.top + pt.y, n: alvo._grp.length}; }''')
    pg.wait_for_timeout(400)
    pg.mouse.click(pos['x'], pos['y'])
    pg.wait_for_timeout(400)
    t1 = pg.inner_text('.leaflet-popup-content')
    pg.click('.pp-nav button[data-pp="next"]')
    pg.wait_for_timeout(200)
    t2 = pg.inner_text('.leaflet-popup-content')
    reg('Edificação comum' in t1 and f"Registro 1 de {pos['n']}" in t1 and f"Registro 2 de {pos['n']}" in t2,
        f"21 Quadro de edificação comum com navegação entre {pos['n']} registros do mesmo local")
    pg.keyboard.press('Escape')

    # 22. Gráficos de faixa e grupo
    clicar_barra('faixa_area', 'd')
    confere('22 Gráfico faixa de área 6.000–20.000', 'S15_faixa_area_6000_20000')
    limpar()
    clicar_barra('grupo', 'media')
    confere('23 Gráfico de grupos → Edificações médias', 'S16_grupo_medias')
    limpar()
    clicar_barra('uso', 'Não residencial', ds=1)
    confere('24 Gráfico Uso → Não residencial', 'S17_uso_nao_residencial')
    limpar()

    # 25. KDE: ativar, alterar raio, opacidade
    pg.evaluate('document.querySelector("#chkKde").scrollIntoView()')
    pg.click('#chkKde')
    pg.wait_for_timeout(500)
    k1 = pg.evaluate('({n: window.painel.ultimaKDE.n, r: window.painel.ultimaKDE.raio, ov: !!window.painel.mapa.lyrKDE && window.painel.mapa.map.hasLayer(window.painel.mapa.lyrKDE)})')
    reg(k1['ov'] and k1['n'] == 3345 and k1['r'] == 800, f"25 KDE ativado: {k1['n']} edificações, raio {k1['r']} m")
    pg.evaluate('''() => { const s = document.getElementById('raioKde'); s.value = 1500; s.dispatchEvent(new Event('input')); }''')
    pg.wait_for_timeout(700)
    k2 = pg.evaluate('({r: window.painel.ultimaKDE.raio, info: document.getElementById("kdeInfo").textContent})')
    reg(k2['r'] == 1500 and '1.500 m' in k2['info'], f"26 Raio alterado → superfície recalculada ({k2['info']})")
    antes = estado()
    pg.evaluate('''() => { const s = document.getElementById('opKde'); s.value = 0.3; s.dispatchEvent(new Event('input')); }''')
    pg.wait_for_timeout(200)
    op = pg.evaluate('window.painel.mapa.lyrKDE.options.opacity')
    reg(abs(op - 0.3) < 1e-9 and estado()['kc'] == antes['kc'], '27 Opacidade do KDE ajustada sem alterar resultados')
    clicar_barra('regional', 'BARREIRO')
    pg.wait_for_timeout(500)
    k3 = pg.evaluate('window.painel.ultimaKDE.n')
    reg(k3 == 334, f'28 KDE acompanha o filtro (Barreiro: {k3} edificações)')
    limpar()

    # 29. Basemap Street/Satellite preserva enquadramento e resultados
    a = estado()
    pg.click('.basemap-switch button[data-fundo="satellite"]')
    pg.wait_for_timeout(300)
    d = estado()
    reg(d['fundo'] == 'satellite' and d['zoom'] == a['zoom'] and abs(d['centro']['lat'] - a['centro']['lat']) < 1e-9 and d['kc'] == a['kc'] and d['val'] == 0,
        '29 Troca para Satellite preserva zoom, centro e resultados')
    pg.click('.basemap-switch button[data-fundo="street"]')
    pg.wait_for_timeout(200)
    reg(estado()['fundo'] == 'street', '30 Retorno para Street')

    # 30b. Camadas são a primeira seção da barra lateral
    prim = pg.evaluate("document.querySelector('.sidebar .sec summary').textContent")
    reg('Camadas' in prim, f'30b Primeira seção da barra lateral: {prim.strip()}')

    # 31. Visibilidade e opacidade das camadas não alteram filtros
    pg.click('#chkComuns')
    pg.wait_for_timeout(200)
    vis = pg.evaluate('window.painel.mapa.map.hasLayer(window.painel.mapa.lyrComuns)')
    pg.evaluate('''() => { const s = document.getElementById('opImpacto'); s.value = 0.4; s.dispatchEvent(new Event('input')); }''')
    pg.evaluate('''() => { const s = document.getElementById('opRegional'); s.value = 0.2; s.dispatchEvent(new Event('input')); }''')
    pg.wait_for_timeout(200)
    e = estado()
    reg(not vis and e['kc'] == '3.345' and e['val'] == 0, '31 Desligar camada e ajustar opacidades não alteram indicadores')
    pg.click('#chkComuns')
    pg.click('#chkRegional'); pg.click('#chkRegional')
    pg.wait_for_timeout(200)

    # 32. Modo destaque (contexto)
    na_lista('ddRegional', '#lstRegional input[value="NORTE"]')
    pg.click('#chkContexto')
    pg.wait_for_timeout(300)
    nctx = pg.evaluate('window.painel.mapa.lyrContexto.getLayers().length')
    reg(nctx == 3374 - 181 - 0 and estado()['val'] == 0, f'32 Destaque: {nctx} registros fora do filtro exibidos em cinza')
    pg.click('#chkContexto')
    limpar()

    # 33. Mapa: clique no polígono da regional filtra
    pg.evaluate('void window.painel.mapa.map.setView([-19.98, -44.0], 13, {animate: false})')
    pg.wait_for_timeout(400)
    # ponto dentro do polígono do Barreiro e a mais de 15 px de qualquer marcador
    pos = pg.evaluate('''() => { const P = window.painel, m = P.mapa.map; let L = null;
        P.mapa.lyrRegional.eachLayer(l => { if (l.feature.properties.nome_regional === 'BARREIRO') L = l; });
        const anel = L.feature.geometry.coordinates[0];
        const dentro = (x, y) => { let c = false; for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
            const [xi, yi] = anel[i], [xj, yj] = anel[j]; if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
        const pts = P.dados.todos.map(r => m.latLngToContainerPoint([r.lat, r.lng]));
        const bb = L.getBounds(), sz = m.getSize();
        for (let i = 1; i < 40; i++) for (let j = 1; j < 40; j++) {
            const lat = bb.getSouth() + (bb.getNorth() - bb.getSouth()) * i / 40, lng = bb.getWest() + (bb.getEast() - bb.getWest()) * j / 40;
            if (!dentro(lng, lat)) continue;
            const pt = m.latLngToContainerPoint([lat, lng]);
            if (pt.x < 60 || pt.y < 60 || pt.x > sz.x - 60 || pt.y > sz.y - 60) continue;
            if (pts.some(q => q.distanceTo(pt) < 15)) continue;
            const b = m.getContainer().getBoundingClientRect(); return {x: b.left + pt.x, y: b.top + pt.y};
        } return null; }''')
    pg.wait_for_timeout(500)
    pg.mouse.click(pos['x'], pos['y'])
    esperar()
    e = estado()
    reg('Barreiro' in e['chips'] and e['val'] == 0, f"33 Clique no polígono da regional aplica filtro (comuns={e['comuns']})")
    limpar()

    # 33b. Comparativo comuns × médias × impacto em bairro SEM edificações médias
    na_lista('ddEmp', '#empLista [data-uid="I:20"]', 'clovis', '#empBusca')
    confere('33b Empreendimento I:20 (Bandeirantes, bairro sem médias)', 'S21_emp_bandeirantes_I20_sem_medias')
    exp = REF['S21_emp_bandeirantes_I20_sem_medias']['esperado']
    txt = pg.inner_text('#comCorpo')
    vals = pg.evaluate('''() => [...document.querySelectorAll('#comCorpo table tbody:first-of-type tr')].map(tr => [...tr.cells].map(c => c.textContent))''')
    num = lambda t: float(t.replace('.', '').replace(',', '.')) if t not in ('—', '') else None
    linha = {r[0]: r[1:] for r in vals}
    ok = ('Não há edificações médias' in txt and num(linha['Registros'][0]) == exp['comum']['n'] and num(linha['Registros'][1]) == 0
          and num(linha['Registros'][2]) == 1 and abs(num(linha['Unidades residenciais'][0]) - exp['comum']['und']) < 0.6
          and abs(num(linha['Unidades residenciais'][2]) - exp['impacto']['und']) < 0.6
          and abs(num(linha['Área construída (m²)'][0]) - exp['comum']['area']) < 0.6)
    reg(ok, f"33c Comparativo usa todas as comuns do bairro ({linha['Registros'][0]} comuns, {linha['Registros'][1]} médias) × impacto, valores = referência")
    limpar()
    vals = pg.evaluate('''() => [...document.querySelectorAll('#comCorpo table tbody:first-of-type tr')].map(tr => [...tr.cells].map(c => c.textContent))''')
    linha = {r[0]: r[1:] for r in vals}
    e1 = REF['S01_sem_filtro']['esperado']
    reg(num(linha['Registros'][0]) == e1['comum']['n'] and num(linha['Registros'][1]) == e1['medias'] and num(linha['Vagas'][2]) == e1['impacto']['vagas'],
        f"33d Comparativo sem filtro: {linha['Registros']} registros (comuns, médias, impacto)")

    # 34. Distribuições: soma do próprio dado, 3 séries, conferida com a referência Python (sem filtro)
    exp = REF['S01_sem_filtro']['esperado']
    for v in ('und', 'vagas', 'area', 'pop'):
        g = pg.evaluate(f'''() => {{ const ch = window.painel.graficos.charts['faixa_{v}'];
            const sm = k => (ch._meta.bruto[k] || []).reduce((a, b) => a + b, 0);
            return {{ series: ch.data.datasets.map(d => d.label), demais: sm('demais'), medias: sm('medias'), impacto: sm('impacto') }}; }}''')
        ok = len(g['series']) == 3 and abs(g['demais'] + g['medias'] - exp['comum'][v]) < 0.02 and abs(g['impacto'] - exp['impacto'][v]) < 0.02
        reg(ok, f"34 Distribuição de {v}: comuns {g['demais']:.0f} + médias {g['medias']:.0f} = {exp['comum'][v]:.0f}; impacto {g['impacto']:.0f} = {exp['impacto'][v]:.0f}")

    # 35. Layout: Camadas → Limpar filtros → Filtro especial; cabeçalho sem selo de consistência
    ordem = pg.evaluate('''() => [...document.querySelector('.sidebar').children].map(e =>
        e.classList.contains('filtros-topo') ? 'LIMPAR' : (e.querySelector('summary') || {}).textContent)''')
    reg('Camadas' in ordem[0] and ordem[1] == 'LIMPAR' and 'Filtro especial' in ordem[2], f'35 Ordem da barra lateral: {ordem[:3]}')
    reg(pg.query_selector('#seloConsistencia') is None and pg.query_selector('.app-header .btn-limpar') is None, '36 Cabeçalho sem consistência/qualidade/limpar')

    # 37. Relatório PDF com os dados em tela (empreendimento selecionado + densidade)
    import shutil, subprocess, tempfile
    reg('novembro/2026' in pg.inner_text('.app-header'), '37 Informativo "Dados de novembro/2026" no cabeçalho')
    if not pg.evaluate('window.painel.mapa.cfg.kde.visivel'):
        pg.click('#chkKde'); pg.wait_for_timeout(300)
    na_lista('ddEmp', '#empLista [data-uid="I:20"]', 'clovis', '#empBusca')
    with pg.expect_download(timeout=90000) as dl:
        pg.click('#btnRelatorio')
    arq = os.path.join(tempfile.gettempdir(), dl.value.suggested_filename)
    dl.value.save_as(arq)
    cab = open(arq, 'rb').read(5)
    info = pg.evaluate('window.painel.ultimoRelatorio')
    reg(cab == b'%PDF-' and arq.endswith('.pdf') and info['paginas'] >= 4, f"38 PDF gerado: {dl.value.suggested_filename} ({info['paginas']} páginas, {info['bytes'] // 1024} KB)")
    if shutil.which('pdftotext'):
        txt = subprocess.run(['pdftotext', '-layout', arq, '-'], capture_output=True, text=True).stdout
        exp = REF['S21_emp_bandeirantes_I20_sem_medias']['esperado']
        raio = pg.evaluate("Number(window.painel.ultimaKDE.raio).toLocaleString('pt-BR')")
        itens = ['Filtros aplicados', 'Indicadores', 'Mapa', 'Tabela comparativa', 'Gráficos', 'Notas metodológicas',
                 'RESIDENCIAIS CLOVIS SALGADO E VIOTTI', 'novembro/2026', f'raio de {raio} m', 'Página 1 de']
        faltam = [i for i in itens if i not in txt]
        num = f"{exp['comum']['area']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        reg(not faltam and num in txt and ' 600 ' in txt, '39 Conteúdo do PDF: seções, empreendimento, referência e valores iguais à tela' + (f' (faltam: {faltam})' if faltam else ''))
    limpar()

    pg.screenshot(path=os.path.join(AQUI, 'captura_final.png'))
    reg(not erros, '35 Nenhum erro de JavaScript durante os testes' + ('' if not erros else ': ' + '; '.join(erros[:3])))
    b.close()

ok = sum(1 for r in res if r[0])
print(f'\nRESULTADO INTERFACE: {ok}/{len(res)} testes OK')
sys.exit(0 if ok == len(res) else 1)
