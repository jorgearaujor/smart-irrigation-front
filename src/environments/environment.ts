import { runtimeFlags } from './runtime-flags';

export const environment = {
  production: false,
  deviceId: 'esp32-01',
  statusPollingIntervalMs: 5000,
  telemetryPollingIntervalMs: 10000,
  apiBaseUrl: runtimeFlags.apiBaseUrl,
  useMockData: runtimeFlags.useMockData,
  requireAuth: runtimeFlags.requireAuth,
};
