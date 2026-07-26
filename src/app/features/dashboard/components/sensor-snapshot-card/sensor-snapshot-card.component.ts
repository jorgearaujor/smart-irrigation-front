import { Component, computed, inject } from '@angular/core';
import { IrrigationService } from '../../../../core/services/irrigation.service';

interface SensorTile {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'critical' | 'neutral';
  icon: 'thermometer' | 'droplets' | 'sprout';
  cardClass: string;
  valueClass: string;
}

const CARD_CLASSES: Record<SensorTile['status'], string> = {
  good: 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40',
  warning: 'rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40',
  critical: 'rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40',
  neutral: 'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900',
};

const VALUE_CLASSES: Record<SensorTile['status'], string> = {
  good: 'text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400',
  warning: 'text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-400',
  critical: 'text-3xl font-bold tracking-tight text-red-700 dark:text-red-400',
  neutral: 'text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100',
};

@Component({
  selector: 'app-sensor-snapshot-card',
  imports: [],
  templateUrl: './sensor-snapshot-card.component.html',
})
export class SensorSnapshotCardComponent {
  private readonly irrigation = inject(IrrigationService);

  protected readonly tiles = computed<SensorTile[]>(() => {
    const telemetry = this.irrigation.latestTelemetry();
    const limiarUmidade = this.irrigation.config()?.limiar_umidade_minima ?? null;

    if (!telemetry) {
      return (
        [
          { label: 'Temperatura', value: '--', status: 'neutral', icon: 'thermometer' },
          { label: 'Umidade do Ar', value: '--', status: 'neutral', icon: 'droplets' },
          { label: 'Umidade do Solo', value: '--', status: 'neutral', icon: 'sprout' },
        ] satisfies Omit<SensorTile, 'cardClass' | 'valueClass'>[]
      ).map((tile) => this.withClasses(tile));
    }

    const soilStatus: SensorTile['status'] =
      limiarUmidade === null
        ? 'neutral'
        : telemetry.soilPercent < limiarUmidade
          ? 'critical'
          : telemetry.soilPercent < limiarUmidade + 10
            ? 'warning'
            : 'good';

    return (
      [
        { label: 'Temperatura', value: `${telemetry.temperature.toFixed(1)}°C`, status: 'neutral', icon: 'thermometer' },
        { label: 'Umidade do Ar', value: `${telemetry.humidity.toFixed(0)}%`, status: 'neutral', icon: 'droplets' },
        { label: 'Umidade do Solo', value: `${telemetry.soilPercent.toFixed(0)}%`, status: soilStatus, icon: 'sprout' },
      ] satisfies Omit<SensorTile, 'cardClass' | 'valueClass'>[]
    ).map((tile) => this.withClasses(tile));
  });

  private withClasses(tile: Omit<SensorTile, 'cardClass' | 'valueClass'>): SensorTile {
    return { ...tile, cardClass: CARD_CLASSES[tile.status], valueClass: VALUE_CLASSES[tile.status] };
  }
}
