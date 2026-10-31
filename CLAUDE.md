# Shelvve (Angular PWA)

My own reading companion: one place for my library, later an LLM chat that knows my reader profile and recommends books.
For the user himself (Pixel 9a, Chrome). Started 2026-10-31 as a fresh take on the abandoned ~/projects/polka.
The user vibe-codes it and writes in Polish; answer in Polish. Code and comments in English, UI in Polish.

**Readability is the point of this project.** The user is an Angular developer and reads the code: write it the way a
careful human would. Plain names, small files, no clever abstractions, comments only for the "why".

## Workflow
- Small slices: one feature per commit, verified on the phone, then propose the next step and wait.
- `npm run phone`: `ng serve` on :4300 + `adb reverse` + opens Chrome on the phone (USB). Reloads on save.
  The dev origin `localhost:4300` has its own IndexedDB, separate from the real library on GitHub Pages: never test
  against the installed app's data.
- `scripts/phone-eval.py '<js>'` runs JS in the phone's dev tab (`- < file.js` for long scripts, `--shot out.png`
  screenshots it). Drive the UI with JS (click, dispatch input/change events) instead of screenshots where possible.
  An EPUB can be fed to the hidden file input with a DataTransfer built from base64 bytes.
- `npm run test:once` (Vitest + jsdom, ~2 s). Tests sit next to the code as `*.spec.ts`.
- `ng build` before committing (budgets, template type checks).
- Deploy = `git push` to main: GitHub Actions tests, builds with `--base-href /shelvve/` and publishes to
  https://piotrc33.github.io/shelvve/ (public repo piotrc33/shelvve). The installed app shows "Jest nowa wersja" and
  reloads on tap.
- Real EPUBs for manual checks: ~/projects/reader/samples/real/*.epub.

## Structure
- `books/`: data. `book.ts` (model), `books-database.ts` (Dexie/IndexedDB schema), `library.ts` (the only service that
  reads/writes books), `epub/read-epub.ts` (metadata + cover from an EPUB, fflate unzip + DOMParser),
  `testing/make-test-epub.ts` (builds EPUBs in memory for specs).
- `library-page/`, `book-page/`: one folder per route, lazy-loaded.
- `shared/`: components used by several pages, plus the service-worker update banner.
- `src/styles.scss`: design tokens (light + dark) and the shared `.top-bar` / `.page` layout. No UI library.
- App icon: edit `public/icons/icon.svg`, then `npm run icons`.

## Data
IndexedDB only, on the phone. The EPUB file itself is not stored, only its metadata and cover (Blob).
Schema changes: add `this.version(n + 1)` in `books-database.ts`, never edit an existing version (the phone has data).
Known gap: clearing site data loses the library. Export/import backup is planned.
fake-indexeddb in specs turns stored Blobs into plain objects; check cover bytes on returned values, not stored ones.

## Plan (proposals, the user decides the order)
Backup export/import · LLM chat about my library (provider and where the API key lives: to decide) · reader profile
built from ratings and thoughts · recommendations · share EPUBs into the app from other apps (Web Share Target).

## Skills
`.claude/skills/` holds design skills from github.com/emilkowalski/skills (mobile-native, break-ui, emil-design-eng,
animate, review-animations, animation-performance). They mention React/Framer Motion: apply the principles in Angular
and plain CSS, never add React libraries.

---
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
