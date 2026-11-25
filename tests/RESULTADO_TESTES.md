# Resultado dos testes — Painel v2

Executado em 25/11/2026, Chrome headless (1700×1000) e Node 22.

## 1. Motor de filtros × referência independente em Python

```
== Cenários de filtro: motor JS × referência Python ==
✔ S01_sem_filtro                                   comuns= 3345 impacto= 29
✔ S02_regional_centro_sul                          comuns=  572 impacto= 10
✔ S03_centro_sul_e_residencial                     comuns=  412 impacto=  0
✔ S04_pampulha_ou_oeste                            comuns= 1125 impacto= 12
✔ S05_bairro_savassi                               comuns=   20 impacto=  4
✔ S06_medias                                       comuns=  177 impacto= 29
✔ S07_medias_nordeste                              comuns=   12 impacto=  3
✔ S08_und_96_300                                   comuns=   87 impacto=  6
✔ S09_area_min_20000                               comuns=    1 impacto= 26
✔ S10_pop_max_500                                  comuns= 3326 impacto=  6
✔ S11_enq_estacionamento                           comuns= 3345 impacto= 15
✔ S12_emp_palmares_I13                             comuns=    7 impacto=  1
✔ S13_emp_serra_I2_medias                          comuns=    7 impacto=  1
✔ S14_emp_olhos_dagua_I10                          comuns=    0 impacto=  1
✔ S15_faixa_area_6000_20000                        comuns=  167 impacto=  3
✔ S16_grupo_medias                                 comuns=  177 impacto=  0
✔ S17_uso_nao_residencial                          comuns=    0 impacto= 15
✔ S18_emp_santa_efigenia_I25_com_regional_leste    comuns=   39 impacto=  1
✔ S20_emp_serra_I2                                 comuns=   57 impacto=  1
✔ S21_emp_bandeirantes_I20_sem_medias              comuns=   70 impacto=  1
✔ S22_regional_hipercentro                         comuns=   14 impacto=  1
✔ S19_vagas_100_400_e_centro_sul_e_misto           comuns=   28 impacto=  5

== Gráfico por Regional (cross-filter exclui a própria dimensão) ==
✔ S01_sem_filtro: {"BARREIRO":334,"CENTRO-SUL":572,"PAMPULHA":706,"OESTE":419,"NORDESTE":320,"NOROESTE":236,"VENDA NOVA":319,"LESTE":244,"NORTE":181,"HIPERCENTRO":14}
✔ S03_centro_sul_e_residencial: {"BARREIRO":290,"CENTRO-SUL":412,"PAMPULHA":661,"OESTE":351,"NORDESTE":269,"NOROESTE":207,"VENDA NOVA":297,"LESTE":211,"NORTE":169}

== Análise de Edificações Médias ==
✔ S02_regional_centro_sul: 72/572 (12.59%)

== Faixas: cada registro em exatamente uma faixa ==
✔ faixa und: 0 registros ambíguos
✔ faixa vagas: 0 registros ambíguos
✔ faixa area: 0 registros ambíguos
✔ faixa pop: 0 registros ambíguos

== KDE: conservação de massa (integral ≈ nº de edificações) e raio em metros ==
✔ raio 200 m: integral 3345.0 / 3345 pontos; máx 264.1 edif/km²
✔ raio 500 m: integral 3345.0 / 3345 pontos; máx 80.5 edif/km²
✔ raio 800 m: integral 3345.0 / 3345 pontos; máx 53.1 edif/km²
✔ raio 1500 m: integral 3345.0 / 3345 pontos; máx 39.2 edif/km²
✔ raio 3000 m: integral 3345.0 / 3345 pontos; máx 27.4 edif/km²
✔ ponto isolado: pico 0.946 (teórico 0.955) edif/km²; nenhum valor além de 1000 m

== Integridade dos arquivos originais ==
✔ GeoJSON originais inalterados (md5)

RESULTADO: 310 verificações OK, 0 falha(s)
```

## 2. Interface no navegador (introdução, relatório e PDF)

```
✔ 00a Abre na página de introdução (cobre toda a tela)
✔ 00b Números da introdução = referência ['29', '3.345', '177']
✔ 00c Introdução com objetivo, contexto, bases, tratamento, filtros e leitura
✔ 00d Botão final "Ir para o relatório"
✔ 00e Botão abre o relatório
✔ 00f Botão "Introdução" volta para a introdução
✔ 01 Carga inicial (3 camadas): KPI 3345/29, mapa 3345/29, esperado 3345/29, consistência 41/41
✔ 01b Camada regional (EPSG:31983) com 10 polígonos, incluindo Hipercentro
✔ 01c Gráfico Regional → Hipercentro: KPI 14/1, mapa 14/1, esperado 14/1, consistência 41/41
✔ 02 Gráfico Regional → Centro-Sul: KPI 572/10, mapa 572/10, esperado 572/10, consistência 41/41
✔ 02b Etiqueta de filtro ativo exibida
✔ 03 + Gráfico Uso → Residencial (AND): KPI 412/0, mapa 412/0, esperado 412/0, consistência 41/41
✔ 04 Clique novamente desmarca Residencial: KPI 572/10, mapa 572/10, esperado 572/10, consistência 41/41
✔ 05 Destaque visual: selecionada em cor cheia, demais esmaecidas
✔ 05b Edificações e impacto no mesmo eixo de valores (eixos: ['x', 'y'])
✔ 06 Limpar seleção individual do gráfico: KPI 3345/29, mapa 3345/29, esperado 3345/29, consistência 41/41
✔ 07 Pampulha OU Oeste (seleção múltipla): KPI 1125/12, mapa 1125/12, esperado 1125/12, consistência 41/41
✔ 08 Limpar filtros (global): KPI 3345/29, mapa 3345/29, esperado 3345/29, consistência 41/41
✔ 08b Etiquetas zeradas
✔ 09b Botão da lista suspensa mostra a seleção
✔ 09 Filtro lateral Bairro = Savassi: KPI 20/4, mapa 20/4, esperado 20/4, consistência 41/41
✔ 10 Edificações Médias: KPI 177/29, mapa 177/29, esperado 177/29, consistência 42/42
✔ 11 Médias + Regional Nordeste: KPI 12/3, mapa 12/3, esperado 12/3, consistência 42/42
✔ 12 Desativar Médias retorna ao universo normal: KPI 3345/29, mapa 3345/29, esperado 3345/29, consistência 41/41
✔ 13 Unidades residenciais 96–300: KPI 87/6, mapa 87/6, esperado 87/6, consistência 41/41
✔ 14 População ≤ 500 (nulos excluídos): KPI 3326/6, mapa 3326/6, esperado 3326/6, consistência 41/41
✔ 15 Enquadramento: estacionamento/400 vagas: KPI 3345/15, mapa 3345/15, esperado 3345/15, consistência 41/41
✔ 16 Remover etiqueta de enquadramento: KPI 3345/29, mapa 3345/29, esperado 3345/29, consistência 41/41
✔ 17 Empreendimento I:13 → edificações do bairro Palmares: KPI 7/1, mapa 7/1, esperado 7/1, consistência 43/43
✔ 17b Painel comparativo com bairro identificado automaticamente
✔ 18 Remover seleção → volta à visualização anterior (Centro-Sul): KPI 572/10, mapa 572/10, esperado 572/10, consistência 41/41
✔ 19 Quadro do ponto (impacto) com todos os campos, "Não informado" e formatação pt-BR
✔ 20 Botão "Comparar" do quadro seleciona o empreendimento (Serra): KPI 57/1, mapa 57/1, esperado 57/1, consistência 43/43
✔ 21 Quadro de edificação comum com navegação entre 3 registros do mesmo local
✔ 22 Gráfico faixa de área 6.000–20.000: KPI 167/3, mapa 167/3, esperado 167/3, consistência 41/41
✔ 23 Gráfico de grupos → Edificações médias: KPI 177/0, mapa 177/0, esperado 177/0, consistência 41/41
✔ 24 Gráfico Uso → Não residencial: KPI 0/15, mapa 0/15, esperado 0/15, consistência 41/41
✔ 25 KDE ativado: 3345 edificações, raio 800 m
✔ 26 Raio alterado → superfície recalculada (3.345 edificações · raio 1.500 m · célula 120 m · 43 ms)
✔ 27 Opacidade do KDE ajustada sem alterar resultados
✔ 28 KDE acompanha o filtro (Barreiro: 334 edificações)
✔ 29 Troca para Satellite preserva zoom, centro e resultados
✔ 30 Retorno para Street
✔ 30b Primeira seção da barra lateral: 🗺️ Camadas
✔ 31 Desligar camada e ajustar opacidades não alteram indicadores
✔ 32 Destaque: 3193 registros fora do filtro exibidos em cinza
✔ 33 Clique no polígono da regional aplica filtro (comuns=334)
✔ 33b Empreendimento I:20 (Bandeirantes, bairro sem médias): KPI 70/1, mapa 70/1, esperado 70/1, consistência 44/44
✔ 33c Comparativo usa todas as comuns do bairro (70 comuns, 0 médias) × impacto, valores = referência
✔ 33d Comparativo sem filtro: ['3.345', '177', '29'] registros (comuns, médias, impacto)
✔ 34 Distribuição de und: comuns 22714 + médias 18477 = 41191; impacto 4220 = 4220
✔ 34 Distribuição de vagas: comuns 37651 + médias 25675 = 63326; impacto 15084 = 15084
✔ 34 Distribuição de area: comuns 2946094 + médias 1875950 = 4822044; impacto 1214411 = 1214411
✔ 34 Distribuição de pop: comuns 56521 + médias 45399 = 101920; impacto 10547 = 10547
✔ 35 Ordem da barra lateral: ['🗺️ Camadas', 'LIMPAR', '🎯 Filtro especial']
✔ 36 Cabeçalho sem consistência/qualidade/limpar
✔ 37 Informativo "Dados de novembro/2026" no cabeçalho
✔ 38 PDF gerado: relatorio_edificacoes_impacto_20261125_1427.pdf (7 páginas, 221 KB)
✔ 39 Conteúdo do PDF: seções, empreendimento, referência e valores iguais à tela
✔ 35 Nenhum erro de JavaScript durante os testes

RESULTADO INTERFACE: 60/60 testes OK
```

## 3. Não testado neste ambiente

- **iniciar_painel.bat / server.ps1**: o ambiente de desenvolvimento não tem Windows/PowerShell. O servidor reaproveita a estrutura HttpListener do painel original (já em uso) e foi revisado manualmente. Os testes usaram um servidor HTTP equivalente.
- **Imagens dos mapas de fundo**: sem acesso externo aos servidores de tiles no ambiente de teste. A troca Street/Satellite foi testada (camada ativa, zoom/centro preservados, resultados inalterados), mas não a exibição das imagens.
