export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
  deviceId: 'esp32-01',
  statusPollingIntervalMs: 5000,
  telemetryPollingIntervalMs: 10000,
  useMockData: true,
  // Login/cadastro ficam implementados e prontos, mas desligados por enquanto:
  // os guards liberam acesso sem sessão até isso ser reativado (mude para true).
  requireAuth: false,
  firebase: {
    apiKey: 'AIzaSyCwbDbnzVwO9WuwJKsFTsMJ5RD_nvcQd-4',
    authDomain: 'smart-irrigation-ifmaker.firebaseapp.com',
    projectId: 'smart-irrigation-ifmaker',
    storageBucket: 'smart-irrigation-ifmaker.firebasestorage.app',
    messagingSenderId: '429510905003',
    appId: '1:429510905003:web:735ae629c66ebbfd6afbee',
    measurementId: 'G-NQDM3D5S41',
  },
};
