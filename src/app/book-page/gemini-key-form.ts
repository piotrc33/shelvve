import { Component, inject, input, output, signal } from '@angular/core';
import { Gemini } from '../gemini/gemini';

@Component({
  selector: 'app-gemini-key-form',
  templateUrl: './gemini-key-form.html',
  styleUrl: './gemini-key-form.scss',
})
export class GeminiKeyForm {
  private readonly gemini = inject(Gemini);

  readonly canCancel = input(false);
  readonly done = output<void>();

  protected readonly apiKeyInput = signal(this.gemini.apiKey());

  protected save() {
    const key = this.apiKeyInput().trim();
    if (!key) {
      return;
    }
    this.gemini.setApiKey(key);
    this.done.emit();
  }

  protected remove() {
    this.gemini.clearApiKey();
    this.done.emit();
  }

  protected cancel() {
    this.done.emit();
  }
}
