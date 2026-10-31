import Dexie, { type EntityTable } from 'dexie';
import { Book } from './book';

/**
 * The IndexedDB database, through Dexie. It lives only in this browser on this device.
 *
 * The schema string lists the primary key and the indexed fields only; other fields are stored without being declared.
 * Changing the schema means adding `this.version(2).stores(...)` below, never editing version 1:
 * the phone already has version 1 and Dexie migrates from it.
 */
export class BooksDatabase extends Dexie {
  books!: EntityTable<Book, 'id'>;

  constructor(name = 'shelvve') {
    super(name);
    this.version(1).stores({
      books: 'id, addedAt',
    });
  }
}
