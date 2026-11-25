/**
 * charts.js
 * Gráficos comparativos detalhados entre Edificações Médias e Empreendimentos de Impacto:
 * 1. Quantidade por Regional
 * 2. Quantidade por Bairro (Top 10)
 * 3. Vagas de Carros geradas (Médias vs. Impacto)
 * 4. Unidades Residenciais geradas (Médias vs. Impacto)
 * 5. População Estimada gerada (Médias vs. Impacto)
 */

class ChartsManager {
  constructor() {
    this.chartBairro = null;
    this.chartVagas = null;
    this.chartUnidades = null;
    this.chartPopulacao = null;

    this.onSelectRegionalCallback = null;
    this.onSelectBairroCallback = null;
  }

  setCallbacks(onRegional, onBairro) {
    this.onSelectRegionalCallback = onRegional;
    this.onSelectBairroCallback = onBairro;
  }

  updateCharts(medias, impacto) {
    this.updateBairroChart(medias, impacto);
    this.updateTotalsComparisonCharts(medias, impacto);
  }

  // 1. Gráfico por Bairro (Top 10)
  updateBairroChart(medias, impacto) {
    const bairrosMap = {};

    medias.forEach(f => {
      const b = f.properties.bairro || 'NÃO INFORMADO';
      if (!bairrosMap[b]) bairrosMap[b] = { medias: 0, impacto: 0 };
      bairrosMap[b].medias++;
    });

    impacto.forEach(f => {
      const b = f.properties.bairro || 'NÃO INFORMADO';
      if (!bairrosMap[b]) bairrosMap[b] = { medias: 0, impacto: 0 };
      bairrosMap[b].impacto++;
    });

    const sortedBairros = Object.keys(bairrosMap)
      .sort((a, b) => {
        const totalA = bairrosMap[a].medias + bairrosMap[a].impacto;
        const totalB = bairrosMap[b].medias + bairrosMap[b].impacto;
        return totalB - totalA;
      })
      .slice(0, 10);

    const labels = sortedBairros;
    const dataMedias = labels.map(b => bairrosMap[b].medias);
    const dataImpacto = labels.map(b => bairrosMap[b].impacto);

    const ctx = document.getElementById('chartBairro');
    if (!ctx) return;

    if (this.chartBairro) {
      this.chartBairro.destroy();
    }

    this.chartBairro = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Edificações Médias',
            data: dataMedias,
            backgroundColor: '#3b82f6',
            borderRadius: 3
          },
          {
            label: 'Impacto',
            data: dataImpacto,
            backgroundColor: '#ef4444',
            borderRadius: 3
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
          y: { stacked: true, ticks: { font: { size: 9 } } }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const clickedBairro = labels[index];
            if (this.onSelectBairroCallback) {
              this.onSelectBairroCallback(clickedBairro);
            }
          }
        }
      }
    });
  }

  // 3, 4 e 5. Gráficos Comparativos: Vagas, Unidades e População Estimada
  updateTotalsComparisonCharts(medias, impacto) {
    // Aggregate totals for both datasets
    let vagasMedias = 0, vagasImpacto = 0;
    let undMedias = 0, undImpacto = 0;
    let popMedias = 0, popImpacto = 0;

    medias.forEach(f => {
      const p = f.properties;
      vagasMedias += p.total_vagas || 0;
      undMedias += p.num_und_residenciais || 0;
      popMedias += p.pop_estimada || 0;
    });

    impacto.forEach(f => {
      const p = f.properties;
      vagasImpacto += p.total_vagas || 0;
      undImpacto += p.num_und_residencial || 0;
      popImpacto += p.pop_estimada || 0;
    });

    // Determine if impact data exists to decide whether to show its bars
    const showImpact = impacto && impacto.length > 0;

    // Helper to create or update a comparative horizontal bar chart
    this.chartVagas = this.createComparisonBar(
      'chartVagas',
      this.chartVagas,
      vagasMedias,
      showImpact ? vagasImpacto : null,
      'Vagas'
    );

    this.chartUnidades = this.createComparisonBar(
      'chartUnidades',
      this.chartUnidades,
      undMedias,
      showImpact ? undImpacto : null,
      'Unidades Res.'
    );

    this.chartPopulacao = this.createComparisonBar(
      'chartPopulacao',
      this.chartPopulacao,
      popMedias,
      showImpact ? popImpacto : null,
      'População Est.'
    );
  }

  createComparisonBar(canvasId, currentChart, valMedias, valImpacto, labelUnit) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (currentChart) {
      currentChart.destroy();
    }

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Edificações Médias', 'Emp. de Impacto'],
        datasets: [{
          data: [valMedias, valImpacto],
          backgroundColor: ['#2563eb', '#dc2626'],
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.parsed.x.toLocaleString('pt-BR')} ${labelUnit}`
            }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 9 } } },
          y: { ticks: { font: { size: 9, weight: 'bold' } } }
        }
      }
    });
  }
}

window.ChartsManager = ChartsManager;
