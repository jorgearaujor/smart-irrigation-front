import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IrrigationService } from '../../../../core/services/irrigation.service';

@Component({
  selector: 'app-location-card',
  imports: [FormsModule],
  templateUrl: './location-card.component.html',
})
export class LocationCardComponent {
  protected readonly irrigation = inject(IrrigationService);

  protected readonly latitude = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);

  constructor() {
    effect(() => {
      const status = this.irrigation.status();
      if (status) {
        this.latitude.set(status.latitude);
      }
    });
  }

  protected updateLatitude(value: string): void {
    this.latitude.set(value === '' ? null : Number(value));
  }

  protected save(): void {
    const latitude = this.latitude();
    if (latitude === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    this.irrigation.updateLatitude(latitude).subscribe({
      complete: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: () => this.saving.set(false),
    });
  }
}
