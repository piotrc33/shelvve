import { TestBed } from '@angular/core/testing';
import { Book } from '../books/book';
import { Gemini, buildChatPayload, buildSystemInstruction, readSseTextChunks } from './gemini';

describe('Gemini service', () => {
  let gemini: Gemini;

  const sampleBook: Book = {
    id: 'test-1',
    title: 'Solaris',
    authors: ['Stanisław Lem'],
    year: 1961,
    publisher: 'Wydawnictwo Literackie',
    rating: 9,
    thoughts: 'Niezwykła wizja kontaktu z obcą inteligencją.',
    addedAt: 1000,
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [Gemini],
    });
    gemini = TestBed.inject(Gemini);
  });

  it('builds system instruction including title, authors, rating and thoughts', () => {
    const instruction = buildSystemInstruction(sampleBook);

    expect(instruction).toContain('„Solaris”');
    expect(instruction).toContain('Stanisław Lem');
    expect(instruction).toContain('1961');
    expect(instruction).toContain('9/10');
    expect(instruction).toContain('Niezwykła wizja kontaktu z obcą inteligencją.');
  });

  it('builds chat payload with prior history followed by the new user message', () => {
    const payload = buildChatPayload(
      sampleBook,
      [{ id: 'm-1', bookId: sampleBook.id, role: 'user', text: 'Pierwsze pytanie', createdAt: 1 }],
      'Drugie pytanie',
    );

    expect(payload.contents).toEqual([
      { role: 'user', parts: [{ text: 'Pierwsze pytanie' }] },
      { role: 'user', parts: [{ text: 'Drugie pytanie' }] },
    ]);
  });

  it('manages API key in localStorage and reactive signals', () => {
    expect(gemini.hasApiKey()).toBe(false);
    expect(gemini.apiKey()).toBe('');

    gemini.setApiKey('test-key-123');
    expect(gemini.hasApiKey()).toBe(true);
    expect(gemini.apiKey()).toBe('test-key-123');
    expect(localStorage.getItem('shelvve:gemini_api_key')).toBe('test-key-123');

    gemini.clearApiKey();
    expect(gemini.hasApiKey()).toBe(false);
    expect(gemini.apiKey()).toBe('');
    expect(localStorage.getItem('shelvve:gemini_api_key')).toBeNull();
  });

  it('throws error when chatting without API key', async () => {
    gemini.clearApiKey();

    await expect(async () => {
      for await (const _chunk of gemini.chatStream(sampleBook, [], 'Pytanie')) {
        // should not reach here
      }
    }).rejects.toThrow('Brak klucza API Gemini');
  });

  it('streams text chunks from mock SSE response', async () => {
    gemini.setApiKey('valid-key');

    const ssePayload = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Cześć! "}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"Solaris to klasyka."}]}}]}\n\n',
    ].join('');

    const mockResponse = new Response(ssePayload, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const chunks: string[] = [];
    for await (const chunk of gemini.chatStream(sampleBook, [], 'Co myślisz?')) {
      chunks.push(chunk);
    }

    expect(chunks.join('')).toBe('Cześć! Solaris to klasyka.');
  });

  it('parses SSE lines split across stream chunks and skips malformed payloads', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":'));
        controller.enqueue(encoder.encode('[{"text":"Podzielony "}]}}]}\n'));
        controller.enqueue(encoder.encode('data: {niepoprawny-json\n'));
        controller.enqueue(
          encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"strumień"}]}}]}\n'),
        );
        controller.close();
      },
    });

    const chunks: string[] = [];
    for await (const chunk of readSseTextChunks(stream)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Podzielony ', 'strumień']);
  });

  it('maps 403 and 429 API errors to readable Polish messages', async () => {
    gemini.setApiKey('bad-key');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'API key invalid' } }), { status: 403 }),
    );
    await expect(async () => {
      for await (const _chunk of gemini.chatStream(sampleBook, [], 'Hej')) {
        // should throw
      }
    }).rejects.toThrow('Nieprawidłowy klucz API Gemini: API key invalid');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 429 }));
    await expect(async () => {
      for await (const _chunk of gemini.chatStream(sampleBook, [], 'Hej')) {
        // should throw
      }
    }).rejects.toThrow('Przekroczono limit zapytań Gemini API');
  });
});
