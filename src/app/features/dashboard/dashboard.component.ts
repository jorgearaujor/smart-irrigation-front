import { Component, inject, signal } from '@angular/core';
import { IrrigationService } from '../../core/services/irrigation.service';
import { ModoIrrigacao } from '../../core/models/device-status.model';
import { StatusHeaderComponent } from './components/status-header/status-header.component';
import { SensorSnapshotCardComponent } from './components/sensor-snapshot-card/sensor-snapshot-card.component';
import { ManualControlCardComponent } from './components/manual-control-card/manual-control-card.component';
import { AutoAuthorizationCardComponent } from './components/auto-authorization-card/auto-authorization-card.component';
import { LastIrrigationCardComponent } from './components/last-irrigation-card/last-irrigation-card.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    StatusHeaderComponent,
    SensorSnapshotCardComponent,
    ManualControlCardComponent,
    AutoAuthorizationCardComponent,
    LastIrrigationCardComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  protected readonly irrigation = inject(IrrigationService);
  protected readonly changingMode = signal(false);

  protected setMode(modo: ModoIrrigacao): void {
    if (this.changingMode() || this.irrigation.status()?.modo === modo) {
      return;
    }
    this.changingMode.set(true);
    this.irrigation.setMode(modo).subscribe({
      complete: () => this.changingMode.set(false),
      error: () => this.changingMode.set(false),
    });
  }
}
