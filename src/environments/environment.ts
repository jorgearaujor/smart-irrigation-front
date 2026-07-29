export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
  deviceId: 'esp32-01',
  statusPollingIntervalMs: 5000,
  telemetryPollingIntervalMs: 10000,
  useMockData: false,
  // Login/cadastro ficam implementados e prontos, mas desligados por enquanto:
  // os guards liberam acesso sem sessão até isso ser reativado (mude para true).
  requireAuth: true,
};
