import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, catchError, interval, merge, of, startWith, switchMap, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DeviceStatus, ModoIrrigacao } from '../models/device-status.model';
import { ConfigIrrigacao } from '../models/config-irrigacao.model';
import { Telemetry } from '../models/telemetry.model';
import { IrrigationHistoryRecord } from '../models/irrigation-history.model';
import { Cultura } from '../models/cultura.model';

@Injectable({ providedIn: 'root' })
export class IrrigationService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly deviceBaseUrl = `${environment.apiBaseUrl}/devices/${environment.deviceId}`;

  private readonly statusRefresh$ = new Subject<void>();
  private readonly telemetryRefresh$ = new Subject<void>();

  readonly status = signal<DeviceStatus | null>(null);
  readonly statusError = signal<string | null>(null);

  readonly config = signal<ConfigIrrigacao | null>(null);
  readonly configLoading = signal(false);

  readonly latestTelemetry = signal<Telemetry | null>(null);

  readonly isManual = computed(() => this.status()?.modo === 'manual');
  readonly isRunning = computed(() => this.status()?.emExecucao ?? false);
  readonly isAuthorized = computed(() => this.status()?.autorizado ?? false);

  constructor() {
    merge(interval(environment.statusPollingIntervalMs), this.statusRefresh$)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchStatus()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    merge(interval(environment.telemetryPollingIntervalMs), this.telemetryRefresh$)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchLatestTelemetry()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.loadConfig();
  }

  refreshStatus(): void {
    this.statusRefresh$.next();
  }

  refreshTelemetry(): void {
    this.telemetryRefresh$.next();
  }

  loadConfig(): void {
    this.configLoading.set(true);
    this.http.get<ConfigIrrigacao>(`${this.deviceBaseUrl}/config-irrigacao`).subscribe({
      next: (config) => {
        this.config.set(config);
        this.configLoading.set(false);
      },
      error: () => this.configLoading.set(false),
    });
  }

  updateConfig(config: ConfigIrrigacao): Observable<void> {
    return this.http.put<void>(`${this.deviceBaseUrl}/config-irrigacao`, config).pipe(
      tap(() => this.config.set(config)),
    );
  }

  startIrrigation(quantidadeAgua: number): Observable<void> {
    return this.http
      .post<void>(`${this.deviceBaseUrl}/irrigation/start`, { quantidadeAgua })
      .pipe(tap(() => this.refreshStatus()));
  }

  stopIrrigation(): Observable<void> {
    return this.http
      .post<void>(`${this.deviceBaseUrl}/irrigation/stop`, {})
      .pipe(tap(() => this.refreshStatus()));
  }

  setMode(modo: ModoIrrigacao): Observable<void> {
    return this.http
      .put<void>(`${this.deviceBaseUrl}/mode`, { modo })
      .pipe(tap(() => this.refreshStatus()));
  }

  setAuthorization(autorizado: boolean): Observable<void> {
    return this.http
      .put<void>(`${this.deviceBaseUrl}/authorization`, { autorizado })
      .pipe(tap(() => this.refreshStatus()));
  }

  updateLatitude(latitude: number): Observable<void> {
    return this.http
      .put<void>(`${this.deviceBaseUrl}/latitude`, { latitude })
      .pipe(tap(() => this.refreshStatus()));
  }

  getCulturas(): Observable<Cultura[]> {
    return this.http.get<Cultura[]>(`${environment.apiBaseUrl}/culturas`);
  }

  getTelemetryHistory(from: Date, to: Date, limit = 1000): Observable<Telemetry[]> {
    const params = new HttpParams()
      .set('from', from.toISOString())
      .set('to', to.toISOString())
      .set('limit', limit);
    return this.http.get<Telemetry[]>(`${this.deviceBaseUrl}/telemetry`, { params });
  }

  getIrrigationHistory(from: Date, to: Date): Observable<IrrigationHistoryRecord[]> {
    const params = new HttpParams().set('from', from.toISOString()).set('to', to.toISOString());
    return this.http.get<IrrigationHistoryRecord[]>(`${this.deviceBaseUrl}/irrigation-history`, { params });
  }

  private fetchStatus() {
    return this.http.get<DeviceStatus>(`${this.deviceBaseUrl}/status`).pipe(
      tap((status) => {
        this.status.set(status);
        this.statusError.set(null);
      }),
      catchError(() => {
        this.statusError.set('Não foi possível carregar o status do dispositivo.');
        return of(null);
      }),
    );
  }

  private fetchLatestTelemetry() {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    return this.getTelemetryHistory(from, to, 1).pipe(
      tap((readings) => {
        if (readings.length > 0) {
          this.latestTelemetry.set(readings[0]);
        }
      }),
      catchError(() => of([])),
    );
  }
}
