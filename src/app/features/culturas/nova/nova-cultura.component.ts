import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IrrigationService } from '../../../core/services/irrigation.service';

@Component({
  selector: 'app-nova-cultura',
  imports: [FormsModule],
  templateUrl: './nova-cultura.component.html',
})
export class NovaCulturaComponent {
  private readonly irrigation = inject(IrrigationService);
  private readonly router = inject(Router);

  protected readonly nome = signal('');
  protected readonly kc1 = signal<number | null>(null);
  protected readonly kc2 = signal<number | null>(null);
  protected readonly kc3 = signal<number | null>(null);
  protected readonly kc4 = signal<number | null>(null);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);

  protected cadastrar(): void {
    if (!this.nome() || this.kc1() == null || this.kc2() == null || this.kc3() == null || this.kc4() == null) {
      this.error.set('Preencha todos os campos');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(false);

    this.irrigation
      .criarCultura({
        nome: this.nome(),
        kc1: this.kc1()!,
        kc2: this.kc2()!,
        kc3: this.kc3()!,
        kc4: this.kc4()!,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(true);
          this.nome.set('');
          this.kc1.set(null);
          this.kc2.set(null);
          this.kc3.set(null);
          this.kc4.set(null);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(
            err?.status === 409 ? 'Já existe uma cultura com esse nome.' : 'Erro ao cadastrar cultura',
          );
        },
      });
  }

  protected voltar(): void {
    this.router.navigateByUrl('/configuracoes');
  }
}
