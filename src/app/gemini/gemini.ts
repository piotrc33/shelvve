import { Service, computed, signal } from '@angular/core';
import { Book } from '../books/book';
import { ChatMessage } from '../books/chat-message';

const API_KEY_STORAGE = 'shelvve:gemini_api_key';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

@Service()
export class Gemini {
  private readonly storedApiKey = signal(readStoredApiKey());

  readonly apiKey = this.storedApiKey.asReadonly();
  readonly hasApiKey = computed(() => this.storedApiKey().length > 0);

  setApiKey(key: string) {
    const trimmed = key.trim();
    this.storedApiKey.set(trimmed);
    writeStoredApiKey(trimmed);
  }

  clearApiKey() {
    this.setApiKey('');
  }

  /** Streams Gemini's reply for a book conversation as Server-Sent Events text fragments. */
  async *chatStream(
    book: Book,
    history: ChatMessage[],
    userMessage: string,
    abortSignal?: AbortSignal,
    model = DEFAULT_GEMINI_MODEL,
  ) {
    const key = this.storedApiKey();
    if (!key) {
      throw new Error('Brak klucza API Gemini. Wpisz klucz w ustawieniach czatu.');
    }

    const response = await fetch(streamUrl(model, key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildChatPayload(book, history, userMessage)),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw await readGeminiError(response);
    }
    if (!response.body) {
      throw new Error('Brak strumienia odpowiedzi z Gemini.');
    }

    yield* readSseTextChunks(response.body);
  }
}

export function buildSystemInstruction(book: Book) {
  const lines = [
    'Jesteś oczytanym, wnikliwym towarzyszem czytelniczym w aplikacji Shelvve.',
    `Rozmawiasz po polsku o książce: „${book.title}”.`,
  ];
  if (book.authors?.length) {
    lines.push(`Autor: ${book.authors.join(', ')}.`);
  }
  if (book.year) {
    lines.push(`Rok wydania: ${book.year}.`);
  }
  if (book.publisher) {
    lines.push(`Wydawnictwo: ${book.publisher}.`);
  }
  if (book.rating) {
    lines.push(`Ocena użytkownika: ${book.rating}/10.`);
  }
  if (book.thoughts?.trim()) {
    lines.push(`Notatki i przemyślenia czytelnika: „${book.thoughts.trim()}”.`);
  }
  lines.push(
    '',
    'Prowadź partnerską, naturalną rozmowę. Pytaj o wrażenia, analizuj motywy i konteksty literackie.',
    'Pisz zwięźle i bez lania wody. Nie zdradzaj spoilerów kluczowych zwrotów akcji, chyba że czytelnik wprost o to poprosi.',
  );
  return lines.join('\n');
}

export function buildChatPayload(book: Book, history: ChatMessage[], userMessage: string) {
  return {
    system_instruction: {
      parts: [{ text: buildSystemInstruction(book) }],
    },
    contents: [
      ...history.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: userMessage }],
      },
    ],
  };
}

export async function* readSseTextChunks(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      yield* lines.map(extractSseText).filter((text): text is string => Boolean(text));
    }
  } finally {
    reader.releaseLock();
  }
}

function extractSseText(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) {
    return undefined;
  }

  const json = trimmed.slice(5).trim();
  if (!json) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(json);
    return parsed.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch {
    return undefined;
  }
}

async function readGeminiError(response: Response) {
  const detail = await response
    .json()
    .then((json) => json?.error?.message as string | undefined)
    .catch(() => undefined);

  const fallback = detail ?? `Błąd API (${response.status})`;
  if (response.status === 400 || response.status === 403) {
    return new Error(`Nieprawidłowy klucz API Gemini: ${fallback}`);
  }
  if (response.status === 429) {
    return new Error('Przekroczono limit zapytań Gemini API. Spróbuj ponownie za chwilę.');
  }
  return new Error(fallback);
}

function streamUrl(model: string, apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${encodeURIComponent(
    apiKey,
  )}&alt=sse`;
}

function readStoredApiKey() {
  if (typeof localStorage === 'undefined') {
    return '';
  }
  return (localStorage.getItem(API_KEY_STORAGE) ?? '').trim();
}

function writeStoredApiKey(key: string) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key);
  } else {
    localStorage.removeItem(API_KEY_STORAGE);
  }
}
