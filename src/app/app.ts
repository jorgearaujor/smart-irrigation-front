import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'droplet' },
    { label: 'Histórico', path: '/historico', icon: 'chart' },
    { label: 'Configurações', path: '/configuracoes', icon: 'settings' },
  ];

  private static isAuthScreen(url: string): boolean {
    return url.startsWith('/login');
  }

  protected readonly showChrome = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => !App.isAuthScreen(event.urlAfterRedirects)),
    ),
    { initialValue: !App.isAuthScreen(this.router.url) },
  );

  protected async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
