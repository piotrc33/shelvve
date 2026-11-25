import { Component, computed, input, output } from '@angular/core';

interface ChatSuggestion {
  label: string;
  prompt: string;
}

const SUMMARY_SUGGESTION: ChatSuggestion = {
  label: 'O czym jest ta książka?',
  prompt: 'O czym dokładnie jest ta książka i jakie są jej najważniejsze motywy?',
};

const THOUGHTS_SUGGESTION: ChatSuggestion = {
  label: 'Co sądzisz o moich notatkach?',
  prompt: 'Nawiąż do moich przemyśleń i powiedz, co o nich sądzisz.',
};

const SIMILAR_SUGGESTION: ChatSuggestion = {
  label: 'Podobne książki',
  prompt: 'Jakie podobne książki możesz mi polecić w tym klimacie?',
};

@Component({
  selector: 'app-chat-suggestions',
  templateUrl: './chat-suggestions.html',
  styleUrl: './chat-suggestions.scss',
})
export class ChatSuggestions {
  readonly hasThoughts = input(false);
  readonly picked = output<string>();

  protected readonly suggestions = computed(() =>
    this.hasThoughts()
      ? [SUMMARY_SUGGESTION, THOUGHTS_SUGGESTION, SIMILAR_SUGGESTION]
      : [SUMMARY_SUGGESTION, SIMILAR_SUGGESTION],
  );
}
