/**
 * app.js
 * Orquestrador da aplicação, coordena filtros, mapa, gráficos e KPIs
 * DALU / Suplan - PBH
 */

document.addEventListener('DOMContentLoaded', async () => {
  const mapManager = new MapManager('map').init();
  const chartsManager = new ChartsManager();

  // Controles de Filtros
  const selectRegional = document.getElementById('filterRegional');
  const selectBairro = document.getElementById('filterBairro');
  const selectEmpreendimento = document.getElementById('filterEmpreendimento');
  const selectEnquadramento = document.getElementById('filterEnquadramento');


  const btnReset = document.getElementById('btnReset');

  // KPIs
  const kpiMedias = document.getElementById('kpiMedias');
  const kpiImpacto = document.getElementById('kpiImpacto');
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiUnidades = document.getElementById('kpiUnidades');
  const kpiPopulacao = document.getElementById('kpiPopulacao');
  const kpiVagas = document.getElementById('kpiVagas');
  const kpiArea = document.getElementById('kpiArea');

  // Camadas e Opacidade
  const chkRegional = document.getElementById('chkRegional');
  const chkMedias = document.getElementById('chkMedias');
  const chkImpacto = document.getElementById('chkImpacto');

  const opRegional = document.getElementById('opRegional');
  const opMedias = document.getElementById('opMedias');
  const opImpacto = document.getElementById('opImpacto');

  // 1. Carregamento dos dados
  try {
    const data = await window.dataService.loadData();

    // Renderiza polígonos das Regionais
    mapManager.renderRegionais(data.regional);

    // Preenche filtros
    const distinct = window.dataService.getDistinctValues();
    populateSelect(selectRegional, distinct.regionais, 'TODAS');
    populateSelect(selectBairro, distinct.bairros, 'TODOS');
    populateSelect(selectEmpreendimento, distinct.empreendimentos, 'TODOS');
    populateSelect(selectEnquadramento, distinct.enquadramentos, 'TODOS');

    // Aplica renderização inicial sem zoom forçado
    applyFilters(false);

  } catch (err) {
    alert('Erro ao carregar dados do painel: ' + err.message);
  }

  function populateSelect(selectEl, items, allLabel) {
    let defaultText = 'Todos';
    if (allLabel === 'TODAS') defaultText = 'Todas as Regionais';
    else if (allLabel === 'TODOS') {
      if (selectEl.id === 'filterBairro') defaultText = 'Todos os Bairros';
      else if (selectEl.id === 'filterEmpreendimento') defaultText = 'Todos os Empreendimentos';
      else if (selectEl.id === 'filterEnquadramento') defaultText = 'Todos os Enquadramentos';
    }

    selectEl.innerHTML = `<option value="${allLabel}">${defaultText}</option>`;
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      selectEl.appendChild(opt);
    });
  }

  function getFilterValues() {
    return {
      regional: selectRegional.value,
      bairro: selectBairro.value,
      empreendimento: selectEmpreendimento ? selectEmpreendimento.value : 'TODOS',
      enquadramento: selectEnquadramento.value
    };
  }

  function applyFilters(shouldZoom = true) {
    const filters = getFilterValues();
    const { medias, impacto } = window.dataService.filterData(filters);

    // 1. Atualizar camadas do mapa
    mapManager.renderEdificacoesMedias(medias);
    mapManager.renderEmpreendimentosImpacto(impacto);

    // Zoom no mapa de acordo com o filtro selecionado
    if (shouldZoom && (medias.length > 0 || impacto.length > 0)) {
      mapManager.fitToBoundsFiltered(medias, impacto, filters.regional);
    }

    // 2. Atualizar gráficos (interagindo diretamente com os filtros)
    chartsManager.updateCharts(medias, impacto);

    // 3. Atualizar KPIs com valores totais
    const kpis = window.dataService.computeKPIs(medias, impacto);
    kpiMedias.textContent = kpis.countMedias.toLocaleString('pt-BR');
    kpiImpacto.textContent = kpis.countImpacto.toLocaleString('pt-BR');
    kpiTotal.textContent = kpis.totalProjetos.toLocaleString('pt-BR');
    kpiUnidades.textContent = kpis.totalUnidades.toLocaleString('pt-BR');
    if (kpiPopulacao) kpiPopulacao.textContent = kpis.totalPopEstimada.toLocaleString('pt-BR');
    kpiVagas.textContent = kpis.totalVagas.toLocaleString('pt-BR');
    kpiArea.textContent = Math.round(kpis.totalArea).toLocaleString('pt-BR') + ' m²';
  }

  // Eventos de formulário
  [selectRegional, selectBairro, selectEmpreendimento, selectEnquadramento].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => {
      if (el === selectRegional) {
        updateBairroOptions();
      }
      applyFilters(true);
    });
  });

  function updateBairroOptions() {
    const selectedReg = selectRegional.value;
    const currentBairro = selectBairro.value;

    const bairrosFiltrados = new Set();
    const allMedias = window.dataService.rawEdificacoesMediasEstudo.features;
    const allImpacto = window.dataService.rawEmpreendimentoImpactoEstudo.features;

    [...allMedias, ...allImpacto].forEach(f => {
      const reg = f.properties.nome_regional;
      const b = f.properties.bairro;
      if (selectedReg === 'TODAS' || reg === selectedReg) {
        if (b) bairrosFiltrados.add(b);
      }
    });

    populateSelect(selectBairro, Array.from(bairrosFiltrados).sort(), 'TODOS');

    if (bairrosFiltrados.has(currentBairro)) {
      selectBairro.value = currentBairro;
    }
  }

  // Botão Limpar Filtros
  btnReset.addEventListener('click', () => {
    selectRegional.value = 'TODAS';
    updateBairroOptions();
    selectBairro.value = 'TODOS';
    if (selectEmpreendimento) selectEmpreendimento.value = 'TODOS';
    selectEnquadramento.value = 'TODOS';

    mapManager.resetView();
    applyFilters(false);
  });

  // Controle de camadas (checkboxes)
  if (chkRegional) chkRegional.addEventListener('change', (e) => mapManager.toggleLayer('regional', e.target.checked));
  if (chkMedias) chkMedias.addEventListener('change', (e) => mapManager.toggleLayer('medias', e.target.checked));
  if (chkImpacto) chkImpacto.addEventListener('change', (e) => mapManager.toggleLayer('impacto', e.target.checked));
  if (chkHeat) chkHeat.addEventListener('change', (e) => mapManager.toggleLayer('heat', e.target.checked));

  // Controle de opacidade (sliders)
  if (opRegional) opRegional.addEventListener('input', (e) => mapManager.setOpacity('regional', parseFloat(e.target.value)));
  if (opMedias) opMedias.addEventListener('input', (e) => mapManager.setOpacity('medias', parseFloat(e.target.value)));
  if (opImpacto) opImpacto.addEventListener('input', (e) => mapManager.setOpacity('impacto', parseFloat(e.target.value)));
  if (opHeat) opHeat.addEventListener('input', (e) => mapManager.setOpacity('heat', parseFloat(e.target.value)));

  // Clique no Mapa na Regional -> Atualiza Filtros e Gráficos
  mapManager.setSelectCallback((item) => {
    if (item.type === 'regional') {
      selectRegional.value = item.name;
      updateBairroOptions();
      applyFilters(true);
    }
  });

  // Clique nos Gráficos -> Filtro e Zoom
  chartsManager.setCallbacks(
    (clickedRegional) => {
      selectRegional.value = clickedRegional;
      updateBairroOptions();
      applyFilters(true);
    },
    (clickedBairro) => {
      selectBairro.value = clickedBairro;
      applyFilters(true);
    }
  );
});
