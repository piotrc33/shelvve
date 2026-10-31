import { Component, effect, input, signal } from '@angular/core';

/** Shows a stored cover image, or a plain tile with the title when the book has none. */
@Component({
  selector: 'app-book-cover',
  template: `
    @if (imageUrl(); as url) {
      <img [src]="url" alt="" />
    } @else {
      <span class="placeholder" aria-hidden="true">{{ title() }}</span>
    }
  `,
  styleUrl: './book-cover.scss',
})
export class BookCover {
  readonly cover = input<Blob>();
  readonly title = input.required<string>();

  protected readonly imageUrl = signal<string | undefined>(undefined);

  constructor() {
    // An object URL keeps its Blob in memory until revoked, so each one is revoked when the cover changes or the
    // component is destroyed. That is why this is an effect with cleanup and not a computed().
    effect((onCleanup) => {
      const cover = this.cover();
      if (!cover) {
        this.imageUrl.set(undefined);
        return;
      }
      const url = URL.createObjectURL(cover);
      this.imageUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }
}
