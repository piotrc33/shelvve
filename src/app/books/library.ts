import { InjectionToken, Service, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { Book } from './book';
import { BooksDatabase } from './books-database';
import { readEpub } from './epub/read-epub';

/** Tests provide a database with a unique name so they don't share data. */
export const BOOKS_DATABASE = new InjectionToken<BooksDatabase>('BOOKS_DATABASE', {
  factory: () => new BooksDatabase(),
});

/** The only place that reads and writes books; components never touch the database directly. */
@Service()
export class Library {
  private readonly db = inject(BOOKS_DATABASE);

  /**
   * All books, newest first. Undefined until the first read finishes, so the page can tell "loading" from "empty".
   * `liveQuery` re-runs after every write, so the list stays current without manual refreshes.
   */
  readonly books = toSignal(
    from(liveQuery(() => this.db.books.orderBy('addedAt').reverse().toArray())),
  );

  async addFromEpub(file: File): Promise<Book> {
    const metadata = await readEpub(file);
    const book: Book = {
      id: crypto.randomUUID(),
      ...metadata,
      thoughts: '',
      addedAt: Date.now(),
    };
    await this.db.books.add(book);
    return book;
  }

  find(id: string): Promise<Book | undefined> {
    return this.db.books.get(id);
  }

  async rate(id: string, rating: number | undefined): Promise<void> {
    await this.db.books.update(id, { rating });
  }

  async saveThoughts(id: string, thoughts: string): Promise<void> {
    await this.db.books.update(id, { thoughts });
  }

  async remove(id: string): Promise<void> {
    await this.db.books.delete(id);
  }
}
