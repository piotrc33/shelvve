import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Book } from '../books/book';
import { ChatMessage } from '../books/chat-message';
import { Library } from '../books/library';
import { Gemini } from '../gemini/gemini';
import { ChatSuggestions } from './chat-suggestions';
import { GeminiKeyForm } from './gemini-key-form';

@Component({
  selector: 'app-book-chat',
  imports: [GeminiKeyForm, ChatSuggestions],
  templateUrl: './book-chat.html',
  styleUrl: './book-chat.scss',
})
export class BookChat {
  private readonly library = inject(Library);
  protected readonly gemini = inject(Gemini);

  readonly book = input.required<Book>();

  private readonly messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesContainer');

  readonly messages = resource<ChatMessage[], string>({
    params: () => this.book().id,
    loader: ({ params: bookId }) => this.library.messagesFor(bookId),
  });

  protected readonly editingKey = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly streamingText = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly inputText = signal('');

  protected readonly showChat = computed(() => this.gemini.hasApiKey() && !this.editingKey());
  protected readonly hasMessages = computed(() => (this.messages.value()?.length ?? 0) > 0);
  protected readonly showSuggestions = computed(() => !this.hasMessages() && !this.streamingText());

  private abortController: AbortController | null = null;

  protected ask(prompt: string) {
    this.inputText.set(prompt);
    void this.send();
  }

  protected onEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      void this.send();
    }
  }

  protected onSubmit(event: Event) {
    event.preventDefault();
    void this.send();
  }

  protected async send() {
    const text = this.inputText().trim();
    if (!text || this.isGenerating()) {
      return;
    }

    this.inputText.set('');
    this.errorMessage.set(null);

    const book = this.book();
    // Capture prior turns before saving the new message, because chatStream sends userMessage separately.
    const history = this.messages.value() ?? [];
    await this.appendMessage(book.id, 'user', text);
    await this.streamReply(book, history, text);
  }

  protected stopGeneration() {
    this.abortController?.abort();
  }

  protected async clearChat() {
    if (!confirm('Wyczyścić dotychczasową rozmowę o tej książce?')) {
      return;
    }
    await this.library.clearMessages(this.book().id);
    this.messages.set([]);
  }

  private async streamReply(book: Book, history: ChatMessage[], text: string) {
    this.isGenerating.set(true);
    this.streamingText.set('');
    this.abortController = new AbortController();

    let accumulated = '';
    let shouldSave = true;

    try {
      for await (const chunk of this.gemini.chatStream(
        book,
        history,
        text,
        this.abortController.signal,
      )) {
        accumulated += chunk;
        this.streamingText.set(accumulated);
        this.scrollToBottom();
      }
    } catch (err) {
      if (!isAbortError(err)) {
        shouldSave = false;
        this.errorMessage.set(
          err instanceof Error ? err.message : 'Wystąpił błąd podczas rozmowy z Gemini.',
        );
      }
    } finally {
      if (shouldSave && accumulated.trim()) {
        await this.appendMessage(book.id, 'model', accumulated.trim());
      }
      this.streamingText.set('');
      this.isGenerating.set(false);
      this.abortController = null;
      this.scrollToBottom();
    }
  }

  private async appendMessage(bookId: string, role: 'user' | 'model', text: string) {
    const message = await this.library.addMessage(bookId, role, text);
    this.messages.update((list) => [...(list ?? []), message]);
    this.scrollToBottom();
  }

  private scrollToBottom() {
    setTimeout(() => {
      const container = this.messagesContainer()?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }
}

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === 'AbortError';
}
