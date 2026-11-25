# Guia de uso

## Página de introdução

O endereço do painel abre numa **página de introdução**, que explica o objetivo do relatório, o contexto dos três grupos analisados (comuns, médias e impacto), as bases de dados, o tratamento dos dados, os filtros e a lógica de seleção, como ler cada parte da tela e os cuidados na interpretação. Os números citados vêm dos próprios dados.

- O botão **Ir para o relatório**, no fim da página (ou o atalho no sumário), abre o relatório. Os dados carregam enquanto a introdução é lida.
- No relatório, o botão **← Introdução**, no cabeçalho, volta para a introdução. O botão "voltar" do navegador também funciona.
- Para abrir direto no relatório, use o endereço com `#painel` (ex.: `https://joseirley.github.io/analise_urbanistica_integrada/#painel`).


## Barra lateral (à esquerda)

**1. Camadas**: liga e desliga cada camada e ajusta a opacidade dela.
- *Empreendimentos de impacto* (vermelho) e *Edificações comuns* (azul; as edificações médias aparecem em laranja; um ponto com borda indica vários registros no mesmo local).
- *Densidade de edificações (Kernel)*: mostra a concentração das edificações comuns filtradas. O controle **Raio** ajusta o raio, em metros.
- *Regionais*: limites das 10 regionais. Clicar num polígono filtra a regional.
- *Mostrar registros fora do filtro em cinza*: mantém o contexto no mapa sem alterar os números.

**2. Filtros**: o botão **⟲ Limpar filtros** fica no topo dos filtros e volta à visão inicial.

**3. Filtro especial – Edificações Médias**: restringe as edificações comuns às próximas dos limiares de impacto.

**4. Empreendimento, território, uso e enquadramento**
- *Empreendimento de Impacto (Nome)*: lista com busca. Ao escolher um empreendimento, o mapa aproxima no bairro dele, as edificações comuns são filtradas pelo mesmo bairro e os comparativos são atualizados. Clique em **Remover seleção** para voltar.
- *Regional*, *Bairro* e *Enquadramento*: listas suspensas com seleção múltipla. Os números ao lado das opções são *comuns · impacto*, já considerando os demais filtros.
- *Uso*: Residencial, Não residencial e Misto.

**5. Quantitativos (mín./máx.)**: faixas de unidades residenciais, vagas, área construída e população estimada.

## Área central

- **Filtros ativos**: etiquetas de tudo o que está filtrado. Clique no **×** para remover uma etiqueta.
- **Indicadores**: quantidades e totais de edificações comuns (azul) e de empreendimentos de impacto (vermelho).
- **Mapa**: clique num ponto para ver regional, bairro, unidades, vagas, área, população, uso e enquadramento. Quando há vários registros no mesmo local, use as setas ‹ ›. Nos empreendimentos de impacto, o botão **Comparar com edificações do bairro** seleciona o empreendimento. O seletor **Street/Satellite** fica no canto superior direito.

## Comparativos (à direita do mapa)

- **Empreendimento × edificações comuns do bairro**: valores do empreendimento, a soma e a média das comuns do bairro e a razão empreendimento ÷ comuns.
- **Edificações comuns × médias × empreendimentos de impacto**: totais, média por registro e barras de participação de cada grupo. Funciona mesmo quando não há edificações médias no recorte.

## Gráficos

- Clique numa barra para filtrar todo o painel. Clique de novo para desmarcar.
- Seleções em gráficos diferentes se combinam (E). Seleções no mesmo gráfico somam opções (OU).
- **limpar**, no título de cada gráfico, remove apenas a seleção daquele gráfico.
- **Escala dos gráficos**: *Quantidade*, em valores absolutos com eixo único, ou *% do grupo*.
- *Comparação entre grupos*: o seletor troca a métrica (registros, unidades, vagas, área, população).
- *Bairros com maior concentração*: ordene por comuns, médias ou impacto.

## Relatório PDF

O botão **📄 Gerar relatório PDF**, no cabeçalho, baixa um PDF com os dados exatamente como estão na tela: filtros, indicadores, mapa, tabela comparativa e gráficos, cada um com uma breve explicação. Para registrar a densidade ou o mapa de satélite, ative-os antes de gerar.
