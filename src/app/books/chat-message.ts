export interface ChatMessage {
  id: string;
  bookId: string;
  role: 'user' | 'model';
  text: string;
  createdAt: number;
}

