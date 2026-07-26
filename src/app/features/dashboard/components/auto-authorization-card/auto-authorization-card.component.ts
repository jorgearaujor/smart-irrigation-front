import { Component, inject, signal } from '@angular/core';
import { IrrigationService } from '../../../../core/services/irrigation.service';

@Component({
  selector: 'app-auto-authorization-card',
  imports: [],
  templateUrl: './auto-authorization-card.component.html',
})
export class AutoAuthorizationCardComponent {
  protected readonly irrigation = inject(IrrigationService);
  protected readonly submitting = signal(false);

  protected toggleAuthorization(): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.irrigation.setAuthorization(!this.irrigation.isAuthorized()).subscribe({
      complete: () => this.submitting.set(false),
      error: () => this.submitting.set(false),
    });
  }
}
