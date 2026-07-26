import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IrrigationService } from '../../../../core/services/irrigation.service';
import { ConfigIrrigacao, FaseCrescimento } from '../../../../core/models/config-irrigacao.model';
import { Cultura } from '../../../../core/models/cultura.model';

@Component({
  selector: 'app-culture-card',
  imports: [FormsModule],
  templateUrl: './culture-card.component.html',
})
export class CultureCardComponent {
  protected readonly irrigation = inject(IrrigationService);

  protected readonly form = signal<ConfigIrrigacao | null>(null);
  protected readonly culturas = signal<Cultura[]>([]);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);

  protected readonly fases: FaseCrescimento[] = [1, 2, 3, 4];

  protected readonly kcAtual = () => {
    const current = this.form();
    const cultura = this.culturas().find((c) => c.nome === current?.cultura);
    if (!current || !cultura) {
      return null;
    }
    return cultura[`kc${current.faseCrescimento}` as `kc${FaseCrescimento}`];
  };

  constructor() {
    effect(() => {
      const config = this.irrigation.config();
      if (config) {
        this.form.set({ ...config });
      }
    });

    this.irrigation.getCulturas().subscribe((culturas) => this.culturas.set(culturas));
  }

  protected updateField<K extends keyof ConfigIrrigacao>(key: K, value: ConfigIrrigacao[K]): void {
    const current = this.form();
    if (!current) {
      return;
    }
    this.form.set({ ...current, [key]: value });
  }

  protected save(): void {
    const current = this.form();
    if (!current || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saved.set(false);

    const kc = this.kcAtual();
    const payload: ConfigIrrigacao = { ...current, kc: kc ?? current.kc };

    this.irrigation.updateConfig(payload).subscribe({
      complete: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: () => this.saving.set(false),
    });
  }
}
