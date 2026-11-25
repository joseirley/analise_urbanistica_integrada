# -*- coding: utf-8 -*-
"""
Referência INDEPENDENTE (Python puro, sem reaproveitar código do painel) para validar o motor JS.
Lê os GeoJSON originais, aplica as regras de negócio descritas no README e grava
tests/referencia.json com os resultados esperados de cada cenário.

Uso:  python tests/referencia_python.py
"""
import json, os, re, unicodedata, hashlib

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(AQUI, '..', 'base')


def ler(nome):
    with open(os.path.join(BASE, nome), encoding='utf-8') as f:
        return json.load(f)['features']


def sem_acento(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().upper()


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    try:
        return float(s.replace(',', '.'))
    except ValueError:
        return None


def uso(v):
    k = sem_acento(v or '').strip()
    return {'RESIDENCIAL': 'Residencial', 'NAO RESIDENCIAL': 'Não residencial', 'MISTO': 'Misto'}.get(k)


CATS = [  # (palavras-chave, categoria) — ordem de teste
    (['PARCELAMENTO'], 'Parcelamento vinculado (lote > 10.000 m² ou quarteirão > 200 m)'),
    (['ESTACIONAMENTO'], 'Edificação com área de estacionamento > 10.000 m² ou mais de 400 vagas'),
    (['20.000', 'AREA'], 'Edificação com mais de 20.000 m² de área total edificada'),
    (['20000', 'AREA'], 'Edificação com mais de 20.000 m² de área total edificada'),
    (['300', 'UNIDADES'], 'Edificação com mais de 300 unidades habitacionais'),
    (['USO COLETIVO'], 'Serviço de uso coletivo com área > 6.000 m²'),
    (['HIPERMERCADO'], 'Hipermercado'),
    (['CASA DE SHOW'], 'Casa de shows e espetáculos'),
    (['INSTALACOES DE ESPORTE'], 'Gestão de instalações de esportes'),
]


def enquadramentos(txt):
    out = []
    for parte in re.split(r'(?<!\d)/|/(?!\d)', txt or ''):
        k = re.sub(r'\s+', ' ', sem_acento(parte)).strip()
        if not k:
            continue
        cat = next((c for chaves, c in CATS if all(ch in k for ch in chaves)), None)
        if cat is None:
            raise SystemExit('Trecho de enquadramento não reconhecido: ' + parte)
        if cat not in out:
            out.append(cat)
    return out


def media(r):
    def em(v, a, b):
        return v is not None and a <= v <= b
    return em(r['vagas'], 100, 400) or em(r['und'], 96, 300) or em(r['area'], 6000, 20000)


def faixa_area(v):
    if v is None: return 'ni'
    if v < 1000: return 'a'
    if v < 3000: return 'b'
    if v < 6000: return 'c'
    if v <= 20000: return 'd'
    return 'e'


REG = []
for f in ler('edificacoes_2.geojson'):
    p = f['properties']
    r = dict(uid='E:%s' % p['_uid_'], tipo='comum', regional=p['nome_regional'].strip().upper(), bairro=p['bairro'].strip(),
             und=num(p['num_und_residenciais']), vagas=num(p['total_vagas']), area=num(p['area_construida']),
             pop=num(p['pop_estimada']), uso=uso(p['uso_projeto']), enq=[])
    r['media'] = media(r)
    REG.append(r)
for f in ler('empreendimento_impacto_estudo_2.geojson'):
    p = f['properties']
    r = dict(uid='I:%s' % p['id'], tipo='impacto', regional=p['nome_regional'].strip().upper(), bairro=p['bairro'].strip(),
             und=num(p.get('und_residenciais')), vagas=num(p['vagas_carros']), area=num(p['ares_construida']),
             pop=num(p.get('pop_estimada')), uso=uso(p['uso']), enq=enquadramentos(p['enquadramento']), media=False)
    REG.append(r)
for r in REG:
    r['grupo'] = 'impacto' if r['tipo'] == 'impacto' else ('media' if r['media'] else 'comum_demais')
    r['faixa_area'] = faixa_area(r['area'])
POR_UID = {r['uid']: r for r in REG}


def aplica(c, excluir=()):
    emp = POR_UID.get(c.get('empreendimento')) if c.get('empreendimento') else None
    sai = []
    for r in REG:
        if emp:
            if r['tipo'] == 'impacto':
                if r['uid'] == emp['uid']:
                    sai.append(r)
                continue
            if sem_acento(r['bairro']) != sem_acento(emp['bairro']):
                continue
        else:
            if 'regional' not in excluir and c.get('regional') and r['regional'] not in c['regional']: continue
            if 'bairro' not in excluir and c.get('bairro') and r['bairro'] not in c['bairro']: continue
        if 'uso' not in excluir and c.get('uso') and r['uso'] not in c['uso']: continue
        if 'grupo' not in excluir and c.get('grupo') and r['grupo'] not in c['grupo']: continue
        if r['tipo'] == 'impacto' and 'enq' not in excluir and c.get('enq') and not set(r['enq']) & set(c['enq']): continue
        if r['tipo'] == 'comum' and 'medias' not in excluir and c.get('medias') and not r['media']: continue
        if 'faixa_area' not in excluir and c.get('faixa_area') and r['faixa_area'] not in c['faixa_area']: continue
        ok = True
        for v, (lo, hi) in (c.get('range') or {}).items():
            x = r[v]
            if x is None or (lo is not None and x < lo) or (hi is not None and x > hi):
                ok = False
        if ok:
            sai.append(r)
    return sai


def resumo(lista):
    out = {}
    for g in ('comum', 'impacto'):
        L = [r for r in lista if r['tipo'] == g]
        d = {'n': len(L)}
        for v in ('und', 'vagas', 'area', 'pop'):
            d[v] = round(sum(r[v] for r in L if r[v] is not None), 2)
        out[g] = d
    out['medias'] = sum(1 for r in lista if r['tipo'] == 'comum' and r['media'])
    uids = sorted(r['uid'] for r in lista)
    out['hash_uids'] = hashlib.md5(','.join(uids).encode()).hexdigest()
    return out


ESTAC = 'Edificação com área de estacionamento > 10.000 m² ou mais de 400 vagas'
CENARIOS = {
    'S01_sem_filtro': {},
    'S02_regional_centro_sul': {'regional': ['CENTRO-SUL']},
    'S03_centro_sul_e_residencial': {'regional': ['CENTRO-SUL'], 'uso': ['Residencial']},
    'S04_pampulha_ou_oeste': {'regional': ['PAMPULHA', 'OESTE']},
    'S05_bairro_savassi': {'bairro': ['Savassi']},
    'S06_medias': {'medias': True},
    'S07_medias_nordeste': {'medias': True, 'regional': ['NORDESTE']},
    'S08_und_96_300': {'range': {'und': (96, 300)}},
    'S09_area_min_20000': {'range': {'area': (20000, None)}},
    'S10_pop_max_500': {'range': {'pop': (None, 500)}},
    'S11_enq_estacionamento': {'enq': [ESTAC]},
    'S12_emp_palmares_I13': {'empreendimento': 'I:13'},
    'S13_emp_serra_I2_medias': {'empreendimento': 'I:2', 'medias': True},
    'S14_emp_olhos_dagua_I10': {'empreendimento': 'I:10'},
    'S15_faixa_area_6000_20000': {'faixa_area': ['d']},
    'S16_grupo_medias': {'grupo': ['media']},
    'S17_uso_nao_residencial': {'uso': ['Não residencial']},
    'S18_emp_santa_efigenia_I25_com_regional_leste': {'empreendimento': 'I:25', 'regional': ['LESTE']},
    'S20_emp_serra_I2': {'empreendimento': 'I:2'},
    'S21_emp_bandeirantes_I20_sem_medias': {'empreendimento': 'I:20'},
    'S22_regional_hipercentro': {'regional': ['HIPERCENTRO']},
    'S19_vagas_100_400_e_centro_sul_e_misto': {'range': {'vagas': (100, 400)}, 'regional': ['CENTRO-SUL'], 'uso': ['Misto']},
}

ref = {'cenarios': {}, 'graficos': {}, 'medias_analise': {}}
for nome, c in CENARIOS.items():
    ref['cenarios'][nome] = {'estado': c, 'esperado': resumo(aplica(c))}

# Gráfico de regional (exclui a própria dimensão) para S03
for nome in ('S01_sem_filtro', 'S03_centro_sul_e_residencial'):
    L = aplica(CENARIOS[nome], excluir=('regional',))
    g = {}
    for r in L:
        k = 'impacto' if r['tipo'] == 'impacto' else 'comuns'
        g.setdefault(k, {}).setdefault(r['regional'], 0)
        g[k][r['regional']] += 1
        if r['tipo'] == 'comum' and r['media']:
            g.setdefault('medias', {}).setdefault(r['regional'], 0)
            g['medias'][r['regional']] += 1
    ref['graficos'][nome] = g

# Análise de médias (universo exclui medias/grupo) para S02
U = [r for r in aplica(CENARIOS['S02_regional_centro_sul'], excluir=('medias', 'grupo')) if r['tipo'] == 'comum']
M = [r for r in U if r['media']]
ref['medias_analise']['S02_regional_centro_sul'] = {
    'universo_n': len(U), 'medias_n': len(M),
    'pct_n': round(100 * len(M) / len(U), 4),
    **{'pct_' + v: round(100 * sum(r[v] for r in M) / sum(r[v] for r in U), 4) for v in ('und', 'vagas', 'area', 'pop')}
}

with open(os.path.join(AQUI, 'referencia.json'), 'w', encoding='utf-8') as f:
    json.dump(ref, f, ensure_ascii=False, indent=1)
for n, c in ref['cenarios'].items():
    e = c['esperado']
    print('%-48s comuns=%5d impacto=%3d medias=%4d' % (n, e['comum']['n'], e['impacto']['n'], e['medias']))
