import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly senha = signal('');
  protected readonly signingIn = signal(false);
  protected readonly error = signal<string | null>(
    this.route.snapshot.queryParamMap.get('unauthorized')
      ? 'Sua conta não tem acesso a este sistema. Fale com o administrador.'
      : null,
  );

  protected async signIn(): Promise<void> {
    if (!this.email() || !this.senha()) {
      this.error.set('Preencha todos os campos');
      return;
    }

    this.signingIn.set(true);
    this.error.set(null);
    try {
      await this.auth.signInWithEmail(this.email(), this.senha());
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
      await this.router.navigateByUrl(returnUrl);
    } catch {
      this.error.set('Erro ao fazer login. Verifique seus dados.');
    } finally {
      this.signingIn.set(false);
    }
  }
}
