import { Component, model } from '@angular/core';
import { MAX_RATING, MIN_RATING } from '../books/book';

/** A row of 1–10 buttons. Tapping the current rating again clears it. */
@Component({
  selector: 'app-rating-picker',
  template: `
    <div class="scale" role="group" aria-label="Twoja ocena">
      @for (value of values; track value) {
        <button
          type="button"
          [class.filled]="value <= (rating() ?? 0)"
          [attr.aria-pressed]="value === rating()"
          (click)="pick(value)"
        >
          {{ value }}
        </button>
      }
    </div>
  `,
  styleUrl: './rating-picker.scss',
})
export class RatingPicker {
  readonly rating = model<number | undefined>();

  protected readonly values = Array.from(
    { length: MAX_RATING - MIN_RATING + 1 },
    (_, i) => MIN_RATING + i,
  );

  protected pick(value: number): void {
    this.rating.set(value === this.rating() ? undefined : value);
  }
}
