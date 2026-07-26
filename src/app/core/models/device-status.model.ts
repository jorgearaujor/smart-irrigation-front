export type ModoIrrigacao = 'manual' | 'automatico';

export interface DeviceStatus {
  modo: ModoIrrigacao;
  autorizado: boolean;
  quantidadeAgua: number;
  tempMin: number | null;
  tempMax: number | null;
  emExecucao: boolean;
  latitude: number | null;
}
