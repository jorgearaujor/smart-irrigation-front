import { Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';

export interface MetricChartPoint {
  timestamp: number;
  value: number;
}

@Component({
  selector: 'app-metric-chart',
  imports: [BaseChartDirective],
  templateUrl: './metric-chart.component.html',
})
export class MetricChartComponent {
  readonly title = input.required<string>();
  readonly unit = input.required<string>();
  readonly color = input.required<string>();
  readonly points = input<MetricChartPoint[]>([]);

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const sorted = [...this.points()].sort((a, b) => a.timestamp - b.timestamp);
    return {
      labels: sorted.map((p) => new Date(p.timestamp).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })),
      datasets: [
        {
          data: sorted.map((p) => p.value),
          label: `${this.title()} (${this.unit()})`,
          borderColor: this.color(),
          backgroundColor: this.color(),
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.3,
          fill: false,
        },
      ],
    };
  });

  protected readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { beginAtZero: false },
    },
    plugins: {
      legend: { display: false },
    },
  };
}
