import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { BooksDatabase } from './books-database';
import { BOOKS_DATABASE, Library } from './library';
import { fakeImage, makeTestEpub } from './testing/make-test-epub';

describe('Library', () => {
  let library: Library;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: BOOKS_DATABASE, useValue: new BooksDatabase(`test-${crypto.randomUUID()}`) },
      ],
    });
    library = TestBed.inject(Library);
  });

  it('adds a book read from an EPUB, unrated and without thoughts', async () => {
    const epub = makeTestEpub({
      metadata: '<dc:title>Solaris</dc:title><dc:creator>Stanisław Lem</dc:creator>',
      manifest: '<item id="c" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
      extraFiles: { 'OEBPS/cover.jpg': fakeImage('solaris') },
    });

    const added = await library.addFromEpub(epub);
    const stored = await library.find(added.id);

    expect(stored).toMatchObject({ title: 'Solaris', authors: ['Stanisław Lem'], thoughts: '' });
    expect(stored?.rating).toBeUndefined();
    // Checked on the returned book: fake-indexeddb clones jsdom's Blob into a plain object (real IndexedDB keeps it).
    expect(await added.cover?.text()).toBe('image:solaris');
    expect(stored?.cover).toBeDefined();
  });

  it('rates a book and clears the rating', async () => {
    const { id } = await library.addFromEpub(makeTestEpub({}));

    await library.rate(id, 8);
    expect((await library.find(id))?.rating).toBe(8);

    await library.rate(id, undefined);
    expect((await library.find(id))?.rating).toBeUndefined();
  });

  it('saves thoughts', async () => {
    const { id } = await library.addFromEpub(makeTestEpub({}));

    await library.saveThoughts(id, 'Ocean jako bohater.');

    expect((await library.find(id))?.thoughts).toBe('Ocean jako bohater.');
  });

  it('removes a book', async () => {
    const { id } = await library.addFromEpub(makeTestEpub({}));

    await library.remove(id);

    expect(await library.find(id)).toBeUndefined();
  });

  it('lists books newest first', async () => {
    await library.addFromEpub(makeTestEpub({ metadata: '<dc:title>Pierwsza</dc:title>' }));
    await new Promise((resolve) => setTimeout(resolve, 2)); // addedAt has millisecond resolution
    await library.addFromEpub(makeTestEpub({ metadata: '<dc:title>Druga</dc:title>' }));

    await vi.waitFor(() =>
      expect(library.books()?.map((book) => book.title)).toEqual(['Druga', 'Pierwsza']),
    );
  });
});
