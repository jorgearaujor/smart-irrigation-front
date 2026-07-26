import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IrrigationService } from '../../../../core/services/irrigation.service';

@Component({
  selector: 'app-status-header',
  imports: [RouterLink],
  templateUrl: './status-header.component.html',
})
export class StatusHeaderComponent {
  protected readonly irrigation = inject(IrrigationService);
}
