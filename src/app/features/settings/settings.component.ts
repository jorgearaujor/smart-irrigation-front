import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgronomicParamsCardComponent } from '../dashboard/components/agronomic-params-card/agronomic-params-card.component';
import { LocationCardComponent } from './components/location-card/location-card.component';
import { CultureCardComponent } from './components/culture-card/culture-card.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  imports: [AgronomicParamsCardComponent, LocationCardComponent, CultureCardComponent, RouterLink],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  protected readonly auth = inject(AuthService);

  protected canManageUsuarios(): boolean {
    return this.auth.canEdit();
  }
}
