import 'fake-indexeddb/auto';
import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Book } from '../books/book';
import { BooksDatabase } from '../books/books-database';
import { BOOKS_DATABASE, Library } from '../books/library';
import { Gemini } from '../gemini/gemini';
import { BookChat } from './book-chat';

describe('BookChat', () => {
  let fixture: ComponentFixture<BookChat>;
  let component: BookChat;
  let componentRef: ComponentRef<BookChat>;
  let library: Library;
  let gemini: Gemini;

  const sampleBook: Book = {
    id: 'b-1',
    title: 'Solaris',
    authors: ['Stanisław Lem'],
    thoughts: 'Ciekawa refleksja nad ograniczeniami człowieka.',
    addedAt: 1000,
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [BookChat],
      providers: [
        { provide: BOOKS_DATABASE, useValue: new BooksDatabase(`test-${crypto.randomUUID()}`) },
        Library,
        Gemini,
      ],
    }).compileComponents();

    library = TestBed.inject(Library);
    gemini = TestBed.inject(Gemini);

    fixture = TestBed.createComponent(BookChat);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('book', sampleBook);
    fixture.detectChanges();
  });

  it('shows API key input when no key is set', () => {
    const input = fixture.nativeElement.querySelector('input[type="password"]');
    expect(input).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Podaj klucz API Gemini');
  });

  it('saves API key and reveals the chat interface', async () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="password"]');
    input.value = 'secret-key-123';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveButton: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-primary');
    saveButton.click();
    fixture.detectChanges();

    expect(gemini.hasApiKey()).toBe(true);
    expect(fixture.nativeElement.querySelector('.input-form')).toBeTruthy();
  });

  it('displays chat messages from the library', async () => {
    gemini.setApiKey('test-key');
    await library.addMessage(sampleBook.id, 'user', 'Jaki jest główny motyw?');
    await library.addMessage(sampleBook.id, 'model', 'Niemożność zrozumienia obcej formy życia.');
    component.messages.reload();
    fixture.detectChanges();

    await vi.waitFor(() => {
      const messages = fixture.nativeElement.querySelectorAll('.message-row');
      expect(messages.length).toBe(2);
      expect(fixture.nativeElement.textContent).toContain('Jaki jest główny motyw?');
      expect(fixture.nativeElement.textContent).toContain('Niemożność zrozumienia');
    });
  });

  it('clears chat history when requested', async () => {
    gemini.setApiKey('test-key');
    await library.addMessage(sampleBook.id, 'user', 'Pierwsza wiadomość');
    component.messages.reload();
    fixture.detectChanges();

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await vi.waitFor(() => {
      const clearBtn = fixture.nativeElement.querySelector(
        '.btn-clear',
      ) as HTMLButtonElement | null;
      expect(clearBtn).toBeTruthy();
    });

    const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-clear');
    clearButton.click();
    fixture.detectChanges();

    await vi.waitFor(async () => {
      const remaining = await library.messagesFor(sampleBook.id);
      expect(remaining).toHaveLength(0);
    });
  });

  it('passes only prior turns in history so the new message is not duplicated', async () => {
    gemini.setApiKey('test-key');
    await library.addMessage(sampleBook.id, 'user', 'Stare pytanie');
    await library.addMessage(sampleBook.id, 'model', 'Stara odpowiedź');
    component.messages.reload();
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(component.messages.value()).toHaveLength(2);
    });

    const chatSpy = vi.spyOn(gemini, 'chatStream').mockImplementation(async function* () {
      yield 'Nowa odpowiedź';
    });

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    textarea.value = 'Nowe pytanie';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const submitButton: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-send');
    submitButton.click();

    await vi.waitFor(() => {
      expect(chatSpy).toHaveBeenCalledOnce();
    });

    const [, history, userMessage] = chatSpy.mock.calls[0];
    expect(history.map((m) => m.text)).toEqual(['Stare pytanie', 'Stara odpowiedź']);
    expect(userMessage).toBe('Nowe pytanie');

    await vi.waitFor(async () => {
      const saved = await library.messagesFor(sampleBook.id);
      expect(saved.map((m) => m.text)).toEqual([
        'Stare pytanie',
        'Stara odpowiedź',
        'Nowe pytanie',
        'Nowa odpowiedź',
      ]);
    });
  });
});
