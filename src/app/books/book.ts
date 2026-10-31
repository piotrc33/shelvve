export interface Book {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  publisher?: string;
  cover?: Blob;
  /** My own rating, 1–10. Undefined = not rated yet. */
  rating?: number;
  /** My free-form thoughts about the book; empty string = none yet. */
  thoughts: string;
  /** Milliseconds since epoch; the library lists the newest first. */
  addedAt: number;
}

export const MIN_RATING = 1;
export const MAX_RATING = 10;
