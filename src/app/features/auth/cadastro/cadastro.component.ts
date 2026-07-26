import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService } from '../../../core/services/usuario.service';
import { TipoUsuario } from '../../../core/models/usuario.model';

@Component({
  selector: 'app-cadastro',
  imports: [FormsModule],
  templateUrl: './cadastro.component.html',
})
export class CadastroComponent {
  private readonly usuarioService = inject(UsuarioService);
  private readonly router = inject(Router);

  protected readonly tipos: TipoUsuario[] = ['Administrador', 'Visualizador'];

  protected readonly nome = signal('');
  protected readonly email = signal('');
  protected readonly senha = signal('');
  protected readonly confirmar = signal('');
  protected readonly tipo = signal<TipoUsuario>('Visualizador');

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);

  protected cadastrar(): void {
    if (!this.nome() || !this.email() || !this.senha() || !this.confirmar()) {
      this.error.set('Preencha todos os campos');
      return;
    }

    if (this.senha() !== this.confirmar()) {
      this.error.set('As senhas não coincidem');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(false);

    this.usuarioService
      .criarUsuario({
        nome: this.nome(),
        email: this.email(),
        senha: this.senha(),
        tipo: this.tipo(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(true);
          this.nome.set('');
          this.email.set('');
          this.senha.set('');
          this.confirmar.set('');
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('Erro ao cadastrar usuário');
        },
      });
  }

  protected voltar(): void {
    this.router.navigateByUrl('/configuracoes');
  }
}
