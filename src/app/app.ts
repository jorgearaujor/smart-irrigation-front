import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected readonly navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'droplet' },
    { label: 'Histórico', path: '/historico', icon: 'chart' },
    { label: 'Configurações', path: '/configuracoes', icon: 'settings' },
  ];
}
