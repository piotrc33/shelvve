import { strToU8, zipSync } from 'fflate';
import { fakeImage, makeTestEpub } from '../testing/make-test-epub';
import { NotAnEpubError, readEpub, resolvePath } from './read-epub';

describe('readEpub', () => {
  it('reads title, author, year and publisher', async () => {
    const epub = makeTestEpub({
      metadata: `
        <dc:title>Solaris</dc:title>
        <dc:creator>Stanisław Lem</dc:creator>
        <dc:date>1961-01-01</dc:date>
        <dc:publisher>Wydawnictwo Literackie</dc:publisher>`,
    });

    const book = await readEpub(epub);

    expect(book).toEqual({
      title: 'Solaris',
      authors: ['Stanisław Lem'],
      year: 1961,
      publisher: 'Wydawnictwo Literackie',
      cover: undefined,
    });
  });

  it('falls back to the file name when the title is missing', async () => {
    const book = await readEpub(makeTestEpub({ fileName: 'Lalka.epub' }));

    expect(book.title).toBe('Lalka');
  });

  it('leaves missing fields undefined', async () => {
    const book = await readEpub(makeTestEpub({ metadata: '<dc:title>Bez metadanych</dc:title>' }));

    expect(book.authors).toEqual([]);
    expect(book.year).toBeUndefined();
    expect(book.publisher).toBeUndefined();
  });

  describe('authors', () => {
    it('keeps every author', async () => {
      const book = await readEpub(
        makeTestEpub({
          metadata: '<dc:creator>Terry Pratchett</dc:creator><dc:creator>Neil Gaiman</dc:creator>',
        }),
      );

      expect(book.authors).toEqual(['Terry Pratchett', 'Neil Gaiman']);
    });

    it('skips an EPUB 2 translator', async () => {
      const book = await readEpub(
        makeTestEpub({
          metadata: `
            <dc:creator opf:role="aut">Haruki Murakami</dc:creator>
            <dc:creator opf:role="trl">Anna Zielińska-Elliott</dc:creator>`,
        }),
      );

      expect(book.authors).toEqual(['Haruki Murakami']);
    });

    it('skips an EPUB 3 translator declared in a refining meta', async () => {
      const book = await readEpub(
        makeTestEpub({
          metadata: `
            <dc:creator id="author">Haruki Murakami</dc:creator>
            <meta refines="#author" property="role" scheme="marc:relators">aut</meta>
            <dc:creator id="translator">Anna Zielińska-Elliott</dc:creator>
            <meta refines="#translator" property="role" scheme="marc:relators">trl</meta>`,
        }),
      );

      expect(book.authors).toEqual(['Haruki Murakami']);
    });
  });

  describe('year', () => {
    it('prefers the EPUB 2 publication date over other dates', async () => {
      const book = await readEpub(
        makeTestEpub({
          metadata: `
            <dc:date opf:event="modification">2021-03-04</dc:date>
            <dc:date opf:event="publication">2012</dc:date>`,
        }),
      );

      expect(book.year).toBe(2012);
    });

    it('reads the year from a full timestamp', async () => {
      const book = await readEpub(
        makeTestEpub({ metadata: '<dc:date>2019-05-01T00:00:00Z</dc:date>' }),
      );

      expect(book.year).toBe(2019);
    });
  });

  describe('cover', () => {
    it('reads an EPUB 3 cover-image', async () => {
      const epub = makeTestEpub({
        manifest: `
          <item id="other" href="images/map.png" media-type="image/png"/>
          <item id="c" href="images/front.jpg" media-type="image/jpeg" properties="cover-image"/>`,
        extraFiles: {
          'OEBPS/images/map.png': fakeImage('map'),
          'OEBPS/images/front.jpg': fakeImage('front'),
        },
      });

      const cover = (await readEpub(epub)).cover;

      expect(cover?.type).toBe('image/jpeg');
      expect(await cover?.text()).toBe('image:front');
    });

    it('reads an EPUB 2 cover declared with <meta name="cover">', async () => {
      const epub = makeTestEpub({
        metadata: '<meta name="cover" content="front-image"/>',
        manifest: '<item id="front-image" href="front.png" media-type="image/png"/>',
        extraFiles: { 'OEBPS/front.png': fakeImage('front') },
      });

      expect(await (await readEpub(epub)).cover?.text()).toBe('image:front');
    });

    it('guesses the cover from the file name when nothing declares it', async () => {
      const epub = makeTestEpub({
        manifest: `
          <item id="img1" href="map.jpg" media-type="image/jpeg"/>
          <item id="img2" href="Cover.jpg" media-type="image/jpeg"/>`,
        extraFiles: { 'OEBPS/map.jpg': fakeImage('map'), 'OEBPS/Cover.jpg': fakeImage('cover') },
      });

      expect(await (await readEpub(epub)).cover?.text()).toBe('image:cover');
    });

    it('finds a cover outside the package folder with an encoded name', async () => {
      const epub = makeTestEpub({
        manifest:
          '<item id="c" href="../Images/my%20cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
        extraFiles: { 'Images/my cover.jpg': fakeImage('cover') },
      });

      expect(await (await readEpub(epub)).cover?.text()).toBe('image:cover');
    });

    it('is undefined when the declared image is missing from the archive', async () => {
      const epub = makeTestEpub({
        manifest: '<item id="c" href="gone.jpg" media-type="image/jpeg" properties="cover-image"/>',
      });

      expect((await readEpub(epub)).cover).toBeUndefined();
    });
  });

  describe('broken files', () => {
    it('rejects a file that is not a zip', async () => {
      const notZip = new File([strToU8('just text') as Uint8Array<ArrayBuffer>], 'notes.epub');

      await expect(readEpub(notZip)).rejects.toThrow(NotAnEpubError);
    });

    it('rejects a zip without container.xml', async () => {
      const zip = zipSync({ mimetype: strToU8('application/epub+zip') });
      const withoutContainer = new File([zip as Uint8Array<ArrayBuffer>], 'empty.epub');

      await expect(readEpub(withoutContainer)).rejects.toThrow(NotAnEpubError);
    });
  });
});

describe('resolvePath', () => {
  it('resolves a path relative to the package document', () => {
    expect(resolvePath('OEBPS/content.opf', 'images/a.jpg')).toBe('OEBPS/images/a.jpg');
  });

  it('resolves "../" and decodes the name', () => {
    expect(resolvePath('OEBPS/content.opf', '../Images/my%20cover.jpg')).toBe(
      'Images/my cover.jpg',
    );
  });

  it('handles a package document at the archive root', () => {
    expect(resolvePath('content.opf', 'cover.png')).toBe('cover.png');
  });
});
