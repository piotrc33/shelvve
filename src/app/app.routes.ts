import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Shelvve',
    loadComponent: () => import('./library-page/library-page').then((m) => m.LibraryPage),
  },
  {
    path: 'books/:id',
    title: 'Shelvve',
    loadComponent: () => import('./book-page/book-page').then((m) => m.BookPage),
  },
  { path: '**', redirectTo: '' },
];
