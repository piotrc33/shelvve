import Dexie, { type EntityTable } from 'dexie';
import { Book } from './book';
import { ChatMessage } from './chat-message';

/**
 * The IndexedDB database, through Dexie. It lives only in this browser on this device.
 *
 * The schema string lists the primary key and the indexed fields only; other fields are stored without being declared.
 * Changing the schema means adding `this.version(n + 1)` below, never editing an existing version:
 * the phone already has previous versions and Dexie migrates from them.
 */
export class BooksDatabase extends Dexie {
  books!: EntityTable<Book, 'id'>;
  messages!: EntityTable<ChatMessage, 'id'>;

  constructor(name = 'shelvve') {
    super(name);
    this.version(1).stores({
      books: 'id, addedAt',
    });
    this.version(2).stores({
      messages: 'id, bookId, createdAt',
    });
  }
}
