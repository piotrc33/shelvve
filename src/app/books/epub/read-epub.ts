import { unzipSync } from 'fflate';

/** What Shelvve takes from an EPUB file. Fields missing in the file stay undefined. */
export interface EpubMetadata {
  title: string;
  authors: string[];
  year?: number;
  publisher?: string;
  cover?: Blob;
}

export class NotAnEpubError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" is not a readable EPUB file`);
  }
}

/**
 * Reads the book's metadata and cover from an EPUB.
 *
 * An EPUB is a zip archive. `META-INF/container.xml` points to the package document (the "OPF" file), which holds the
 * Dublin Core metadata (`dc:title`, `dc:creator`, ...) and the manifest: the list of every file in the book.
 */
export async function readEpub(file: File): Promise<EpubMetadata> {
  const zip = new ZipReader(new Uint8Array(await file.arrayBuffer()), file.name);

  const container = zip.readXml('META-INF/container.xml');
  const packagePath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!packagePath) {
    throw new NotAnEpubError(file.name);
  }
  const opf = zip.readXml(packagePath);

  return {
    title: readText(opf, 'title') ?? titleFromFileName(file.name),
    authors: readAuthors(opf),
    year: readYear(opf),
    publisher: readText(opf, 'publisher'),
    cover: readCover(zip, opf, packagePath),
  };
}

/** Unzips only the entries we ask for: inflating a whole book (images, fonts) would take seconds on a phone. */
class ZipReader {
  constructor(
    private readonly bytes: Uint8Array,
    private readonly fileName: string,
  ) {}

  read(path: string): Uint8Array | undefined {
    try {
      return unzipSync(this.bytes, { filter: (entry) => entry.name === path })[path];
    } catch {
      throw new NotAnEpubError(this.fileName);
    }
  }

  readXml(path: string): Document {
    const bytes = this.read(path);
    if (!bytes) {
      throw new NotAnEpubError(this.fileName);
    }
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
    if (xml.querySelector('parsererror')) {
      throw new NotAnEpubError(this.fileName);
    }
    return xml;
  }
}

/**
 * Elements are looked up by local name in any namespace: `dc:title`, `title` and a wrongly declared Dublin Core
 * namespace all happen in real-world files.
 */
function elements(opf: Document, localName: string): Element[] {
  return Array.from(opf.getElementsByTagNameNS('*', localName));
}

function readText(opf: Document, localName: string): string | undefined {
  const text = elements(opf, localName)[0]?.textContent?.trim();
  return text || undefined;
}

/**
 * Creators without a role are treated as authors. Translators and illustrators are sometimes listed as creators too,
 * so creators with any role other than "aut" are skipped.
 */
function readAuthors(opf: Document): string[] {
  return elements(opf, 'creator')
    .filter((creator) => {
      const role = creatorRole(opf, creator);
      return role === undefined || role === 'aut';
    })
    .map((creator) => creator.textContent?.trim() ?? '')
    .filter((name) => name !== '');
}

/** EPUB 2 puts the role in an `opf:role` attribute, EPUB 3 in a `<meta refines="#creator-id" property="role">`. */
function creatorRole(opf: Document, creator: Element): string | undefined {
  const epub2Role = creator.getAttribute('opf:role') ?? creator.getAttributeNS('*', 'role');
  if (epub2Role) {
    return epub2Role;
  }
  const id = creator.getAttribute('id');
  if (!id) {
    return undefined;
  }
  const refinement = elements(opf, 'meta').find(
    (meta) => meta.getAttribute('refines') === `#${id}` && meta.getAttribute('property') === 'role',
  );
  return refinement?.textContent?.trim() || undefined;
}

/**
 * EPUB 2 may list several dates (publication, modification, ...); the publication one is preferred.
 * Dates come in many shapes ("2019", "2019-05-01", "2019-05-01T00:00:00Z"), only the year is kept.
 */
function readYear(opf: Document): number | undefined {
  const dates = elements(opf, 'date');
  const publicationDate =
    dates.find((date) => date.getAttribute('opf:event') === 'publication') ?? dates[0];
  const year = publicationDate?.textContent?.match(/\d{4}/)?.[0];
  return year ? Number(year) : undefined;
}

/**
 * Covers are declared in three different ways, tried from the most to the least reliable:
 * 1. EPUB 3: the manifest item with `properties="cover-image"`.
 * 2. EPUB 2: `<meta name="cover" content="item-id">` (some tools put the file path in `content` instead of the id).
 * 3. No declaration: any image in the manifest with "cover" in its id or path.
 */
function readCover(zip: ZipReader, opf: Document, packagePath: string): Blob | undefined {
  const images = elements(opf, 'item').filter((item) =>
    item.getAttribute('media-type')?.startsWith('image/'),
  );
  const coverMetaContent = elements(opf, 'meta')
    .find((meta) => meta.getAttribute('name') === 'cover')
    ?.getAttribute('content');

  const coverItem =
    images.find((item) => item.getAttribute('properties')?.split(' ').includes('cover-image')) ??
    images.find(
      (item) =>
        coverMetaContent !== undefined &&
        (item.getAttribute('id') === coverMetaContent ||
          item.getAttribute('href') === coverMetaContent),
    ) ??
    images.find((item) => /cover/i.test(`${item.getAttribute('id')} ${item.getAttribute('href')}`));

  const href = coverItem?.getAttribute('href');
  if (!coverItem || !href) {
    return undefined;
  }
  const bytes = zip.read(resolvePath(packagePath, href));
  if (!bytes) {
    return undefined;
  }
  return new Blob([bytes as Uint8Array<ArrayBuffer>], {
    type: coverItem.getAttribute('media-type') ?? undefined,
  });
}

/**
 * Manifest paths are relative to the package document and URL-encoded ("../Images/my%20cover.jpg").
 * The URL API resolves "../" for us; the "file:///" base is only a placeholder.
 */
export function resolvePath(packagePath: string, href: string): string {
  const url = new URL(href, `file:///${packagePath}`);
  return decodeURIComponent(url.pathname.slice(1));
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.epub$/i, '');
}
