import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IrrigationService } from '../../../../core/services/irrigation.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfigIrrigacao } from '../../../../core/models/config-irrigacao.model';

@Component({
  selector: 'app-agronomic-params-card',
  imports: [FormsModule],
  templateUrl: './agronomic-params-card.component.html',
})
export class AgronomicParamsCardComponent {
  protected readonly irrigation = inject(IrrigationService);
  protected readonly auth = inject(AuthService);

  protected readonly form = signal<ConfigIrrigacao | null>(null);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);

  constructor() {
    effect(() => {
      const config = this.irrigation.config();
      if (config) {
        this.form.set({ ...config });
      }
    });
  }

  protected updateField<K extends keyof ConfigIrrigacao>(key: K, value: string): void {
    const current = this.form();
    if (!current) {
      return;
    }
    this.form.set({ ...current, [key]: Number(value) });
  }

  protected save(): void {
    const current = this.form();
    if (!current || this.saving() || !this.auth.canEdit()) {
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    this.irrigation.updateConfig(current).subscribe({
      complete: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: () => this.saving.set(false),
    });
  }
}
