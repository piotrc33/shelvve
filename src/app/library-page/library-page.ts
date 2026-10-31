import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Library } from '../books/library';
import { BookCover } from '../shared/book-cover';

@Component({
  selector: 'app-library-page',
  imports: [RouterLink, BookCover],
  templateUrl: './library-page.html',
  styleUrl: './library-page.scss',
})
export class LibraryPage {
  private readonly library = inject(Library);
  private readonly router = inject(Router);

  protected readonly books = this.library.books;
  protected readonly adding = signal(false);
  protected readonly unreadableFiles = signal<string[]>([]);

  /** One book opens its page right away so it can be rated; several stay on the shelf. */
  protected async addFiles(input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files ?? []);
    input.value = ''; // lets the same file be picked again after a failure
    if (files.length === 0) {
      return;
    }

    this.adding.set(true);
    this.unreadableFiles.set([]);
    const added = [];
    for (const file of files) {
      try {
        added.push(await this.library.addFromEpub(file));
      } catch {
        this.unreadableFiles.update((names) => [...names, file.name]);
      }
    }
    this.adding.set(false);

    if (files.length === 1 && added.length === 1) {
      await this.router.navigate(['/books', added[0].id]);
    }
  }
}
