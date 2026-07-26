export interface Telemetry {
  temperature: number;
  humidity: number;
  soilPercent: number;
  timestamp: number;
}

export type TelemetryRangePreset = '24h' | '7d' | '30d';
