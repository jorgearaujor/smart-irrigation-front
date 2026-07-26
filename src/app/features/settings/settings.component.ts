import { Component } from '@angular/core';
import { AgronomicParamsCardComponent } from '../dashboard/components/agronomic-params-card/agronomic-params-card.component';
import { LocationCardComponent } from './components/location-card/location-card.component';
import { CultureCardComponent } from './components/culture-card/culture-card.component';

@Component({
  selector: 'app-settings',
  imports: [AgronomicParamsCardComponent, LocationCardComponent, CultureCardComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {}
