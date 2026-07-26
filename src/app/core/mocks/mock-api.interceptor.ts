import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DeviceStatus, ModoIrrigacao } from '../models/device-status.model';
import { ConfigIrrigacao } from '../models/config-irrigacao.model';
import { Telemetry } from '../models/telemetry.model';
import { IrrigationHistoryRecord } from '../models/irrigation-history.model';
import { Cultura } from '../models/cultura.model';

const deviceBaseUrl = `${environment.apiBaseUrl}/devices/${environment.deviceId}`;
const culturasUrl = `${environment.apiBaseUrl}/culturas`;
const MOCK_DELAY_MS = 300;

let mockStatus: DeviceStatus = {
  modo: 'automatico',
  autorizado: true,
  quantidadeAgua: 12,
  tempMin: 18,
  tempMax: 32,
  emExecucao: false,
  latitude: -23.55,
};

let mockConfig: ConfigIrrigacao = {
  kc: 0.9,
  cultura: 'Tomate',
  faseCrescimento: 3,
  espacamento_plantas_m: 0.5,
  espacamento_linhas_m: 1.2,
  vazao_gotejador_lph: 4,
  num_gotejadores_planta: 2,
  numero_total_plantas: 120,
  limiar_umidade_minima: 35,
};

const mockCulturas: Cultura[] = [
  { nome: 'Tomate', kc1: 0.6, kc2: 0.8, kc3: 1.15, kc4: 0.9 },
  { nome: 'Alface', kc1: 0.7, kc2: 0.9, kc3: 1.0, kc4: 0.95 },
  { nome: 'Milho', kc1: 0.4, kc2: 0.8, kc3: 1.15, kc4: 0.7 },
  { nome: 'Feijão', kc1: 0.5, kc2: 0.75, kc3: 1.05, kc4: 0.85 },
  { nome: 'Soja', kc1: 0.5, kc2: 0.8, kc3: 1.1, kc4: 0.6 },
];

function generateTelemetry(from: Date, to: Date, limit: number): Telemetry[] {
  const spanMs = Math.max(to.getTime() - from.getTime(), 1);
  const count = Math.min(limit, 200);
  const stepMs = spanMs / Math.max(count, 1);

  return Array.from({ length: count }, (_, i) => {
    const timestamp = to.getTime() - i * stepMs;
    const hourOfDay = new Date(timestamp).getHours() + new Date(timestamp).getMinutes() / 60;
    const wave = ((hourOfDay - 6) / 24) * 2 * Math.PI;
    return {
      temperature: Number((22 + 8 * Math.sin(wave) + (Math.random() - 0.5) * 2).toFixed(1)),
      humidity: Number(
        Math.max(0, Math.min(100, 60 - 15 * Math.sin(wave) + (Math.random() - 0.5) * 4)).toFixed(1),
      ),
      soilPercent: Number(
        Math.max(0, Math.min(100, 45 + 10 * Math.sin(i * 0.15) + (Math.random() - 0.5) * 5)).toFixed(1),
      ),
      timestamp,
    };
  });
}

function generateIrrigationHistory(from: Date, to: Date): IrrigationHistoryRecord[] {
  const spanMs = Math.max(to.getTime() - from.getTime(), 1);
  const count = 8;

  return Array.from({ length: count }, (_, i) => {
    const date = new Date(to.getTime() - i * (spanMs / count));
    const volumePorPlanta = Number((0.5 + Math.random() * 1.5).toFixed(2));
    return {
      umidadeAtual: Number((30 + Math.random() * 20).toFixed(1)),
      tempo: `${5 + Math.floor(Math.random() * 15)} min`,
      volumePorPlanta,
      volumeTotal: Number((volumePorPlanta * mockConfig.numero_total_plantas).toFixed(1)),
      data: date.toLocaleDateString('pt-BR'),
      hora: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      modo: i % 3 === 0 ? 'manual' : 'automatico',
    };
  });
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMockData) {
    return next(req);
  }

  const respond = (body: unknown) => of(new HttpResponse({ status: 200, body })).pipe(delay(MOCK_DELAY_MS));

  if (req.url === culturasUrl && req.method === 'GET') {
    return respond(mockCulturas);
  }

  if (!req.url.startsWith(deviceBaseUrl)) {
    return next(req);
  }

  const path = req.url.slice(deviceBaseUrl.length);

  if (path === '/status' && req.method === 'GET') {
    return respond(mockStatus);
  }

  if (path === '/config-irrigacao' && req.method === 'GET') {
    return respond(mockConfig);
  }

  if (path === '/config-irrigacao' && req.method === 'PUT') {
    mockConfig = req.body as ConfigIrrigacao;
    return respond(null);
  }

  if (path === '/irrigation/start' && req.method === 'POST') {
    const { quantidadeAgua } = req.body as { quantidadeAgua: number };
    mockStatus = { ...mockStatus, emExecucao: true, quantidadeAgua };
    return respond(null);
  }

  if (path === '/irrigation/stop' && req.method === 'POST') {
    mockStatus = { ...mockStatus, emExecucao: false };
    return respond(null);
  }

  if (path === '/mode' && req.method === 'PUT') {
    const { modo } = req.body as { modo: ModoIrrigacao };
    mockStatus = { ...mockStatus, modo };
    return respond(null);
  }

  if (path === '/authorization' && req.method === 'PUT') {
    const { autorizado } = req.body as { autorizado: boolean };
    mockStatus = { ...mockStatus, autorizado };
    return respond(null);
  }

  if (path === '/latitude' && req.method === 'PUT') {
    const { latitude } = req.body as { latitude: number };
    mockStatus = { ...mockStatus, latitude };
    return respond(null);
  }

  if (path.startsWith('/telemetry') && req.method === 'GET') {
    const from = new Date(req.params.get('from')!);
    const to = new Date(req.params.get('to')!);
    const limit = Number(req.params.get('limit') ?? 1000);
    return respond(generateTelemetry(from, to, limit));
  }

  if (path.startsWith('/irrigation-history') && req.method === 'GET') {
    const from = new Date(req.params.get('from')!);
    const to = new Date(req.params.get('to')!);
    return respond(generateIrrigationHistory(from, to));
  }

  return next(req);
};
