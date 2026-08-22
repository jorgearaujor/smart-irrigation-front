import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IrrigationService } from '../../../../core/services/irrigation.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-manual-control-card',
  imports: [FormsModule],
  templateUrl: './manual-control-card.component.html',
})
export class ManualControlCardComponent {
  protected readonly irrigation = inject(IrrigationService);
  protected readonly auth = inject(AuthService);
  protected readonly Math = Math;

  protected readonly volumeLitros = signal(30);
  protected readonly submitting = signal(false);

  protected start(): void {
    if (this.volumeLitros() <= 0 || this.submitting() || !this.auth.canEdit()) {
      return;
    }
    this.submitting.set(true);
    this.irrigation.startIrrigation(this.volumeLitros()).subscribe({
      complete: () => this.submitting.set(false),
      error: () => this.submitting.set(false),
    });
  }

  protected stop(): void {
    if (this.submitting() || !this.auth.canEdit()) {
      return;
    }
    this.submitting.set(true);
    this.irrigation.stopIrrigation().subscribe({
      complete: () => this.submitting.set(false),
      error: () => this.submitting.set(false),
    });
  }
}
