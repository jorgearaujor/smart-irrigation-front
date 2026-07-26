import { Component, computed, inject, signal } from '@angular/core';
import { IrrigationService } from '../../core/services/irrigation.service';
import { Telemetry, TelemetryRangePreset } from '../../core/models/telemetry.model';
import { IrrigationHistoryRecord } from '../../core/models/irrigation-history.model';
import { MetricChartComponent, MetricChartPoint } from './components/metric-chart/metric-chart.component';

const RANGE_HOURS: Record<TelemetryRangePreset, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

@Component({
  selector: 'app-historical-charts',
  imports: [MetricChartComponent],
  templateUrl: './historical-charts.component.html',
})
export class HistoricalChartsComponent {
  private readonly irrigation = inject(IrrigationService);

  protected readonly ranges: { value: TelemetryRangePreset; label: string }[] = [
    { value: '24h', label: 'Últimas 24h' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
  ];

  protected readonly selectedRange = signal<TelemetryRangePreset>('24h');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly telemetry = signal<Telemetry[]>([]);
  protected readonly irrigationHistory = signal<IrrigationHistoryRecord[]>([]);

  protected readonly temperaturePoints = computed<MetricChartPoint[]>(() =>
    this.telemetry().map((t) => ({ timestamp: t.timestamp, value: t.temperature })),
  );
  protected readonly humidityPoints = computed<MetricChartPoint[]>(() =>
    this.telemetry().map((t) => ({ timestamp: t.timestamp, value: t.humidity })),
  );
  protected readonly soilPoints = computed<MetricChartPoint[]>(() =>
    this.telemetry().map((t) => ({ timestamp: t.timestamp, value: t.soilPercent })),
  );

  constructor() {
    this.loadData();
  }

  protected selectRange(range: TelemetryRangePreset): void {
    if (range === this.selectedRange()) {
      return;
    }
    this.selectedRange.set(range);
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    const to = new Date();
    const from = new Date(to.getTime() - RANGE_HOURS[this.selectedRange()] * 60 * 60 * 1000);

    this.irrigation.getTelemetryHistory(from, to, 2000).subscribe({
      next: (readings) => {
        this.telemetry.set(readings);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível carregar o histórico de telemetria.');
        this.loading.set(false);
      },
    });

    this.irrigation.getIrrigationHistory(from, to).subscribe({
      next: (records) => this.irrigationHistory.set(records),
      error: () => this.irrigationHistory.set([]),
    });
  }
}
