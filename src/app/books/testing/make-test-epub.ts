import { strToU8, zipSync } from 'fflate';

/**
 * Builds a minimal EPUB in memory for tests.
 * `metadata` and `manifest` are pasted into the package document as-is, so each test shows the exact XML it reads.
 */
export function makeTestEpub(options: {
  metadata?: string;
  manifest?: string;
  packagePath?: string;
  extraFiles?: Record<string, Uint8Array>;
  fileName?: string;
}): File {
  const packagePath = options.packagePath ?? 'OEBPS/content.opf';
  const container = `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles><rootfile full-path="${packagePath}" media-type="application/oebps-package+xml"/></rootfiles>
    </container>`;
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" xmlns:opf="http://www.idpf.org/2007/opf" version="3.0">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${options.metadata ?? ''}</metadata>
      <manifest>${options.manifest ?? ''}</manifest>
    </package>`;

  const zip = zipSync({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(container),
    [packagePath]: strToU8(opf),
    ...options.extraFiles,
  });
  return new File([zip as Uint8Array<ArrayBuffer>], options.fileName ?? 'book.epub');
}

/** A few bytes standing in for an image: tests only check that the right file was picked. */
export function fakeImage(label: string): Uint8Array {
  return strToU8(`image:${label}`);
}
