import { Component, OnInit, inject, signal } from '@angular/core';
import { IrrigationService } from '../../../../core/services/irrigation.service';
import { IrrigationHistoryRecord } from '../../../../core/models/irrigation-history.model';

@Component({
  selector: 'app-last-irrigation-card',
  imports: [],
  templateUrl: './last-irrigation-card.component.html',
})
export class LastIrrigationCardComponent implements OnInit {
  private readonly irrigation = inject(IrrigationService);

  protected readonly lastRecord = signal<IrrigationHistoryRecord | null>(null);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.irrigation.getIrrigationHistory(from, to).subscribe({
      next: (records) => {
        this.lastRecord.set(records[0] ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
