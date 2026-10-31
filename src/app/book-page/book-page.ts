import { Component, inject, input, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Library } from '../books/library';
import { BookCover } from '../shared/book-cover';
import { RatingPicker } from './rating-picker';

@Component({
  selector: 'app-book-page',
  imports: [RouterLink, BookCover, RatingPicker],
  templateUrl: './book-page.html',
  styleUrl: './book-page.scss',
})
export class BookPage {
  private readonly library = inject(Library);
  private readonly router = inject(Router);

  /** From the route `books/:id` (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly book = resource({
    params: () => this.id(),
    loader: ({ params: id }) => this.library.find(id),
  });

  protected async rate(rating: number | undefined): Promise<void> {
    this.book.update((book) => book && { ...book, rating });
    await this.library.rate(this.id(), rating);
  }

  /**
   * Saved on every keystroke: an IndexedDB write takes a few milliseconds and there's no "Save" button to forget.
   * The local copy is updated too, so the textarea binding keeps the same value and the cursor doesn't jump.
   */
  protected async saveThoughts(thoughts: string): Promise<void> {
    this.book.update((book) => book && { ...book, thoughts });
    await this.library.saveThoughts(this.id(), thoughts);
  }

  protected async remove(): Promise<void> {
    const title = this.book.value()?.title;
    if (!confirm(`Usunąć „${title}” z półki? Ocena i przemyślenia też znikną.`)) {
      return;
    }
    await this.library.remove(this.id());
    await this.router.navigate(['/']);
  }
}
