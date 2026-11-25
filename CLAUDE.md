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
- `npm run lint` (ESLint + angular-eslint readability & a11y rules) and `ng build` (budgets, template type checks)
  before committing.
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
- `.claude/skills/review-readability/`: post-implementation readability & anti-abstraction checklist tailored to this
  project. Run it on `git diff` before wrapping up any non-trivial change.
- `.claude/skills/` also holds design skills from github.com/emilkowalski/skills (mobile-native, break-ui,
  emil-design-eng, animate, review-animations, animation-performance). They mention React/Framer Motion: apply the
  principles in Angular and plain CSS, never add React libraries.

## Readability & Style
Gold-standard examples in this repo: `src/app/books/epub/read-epub.ts` (top-down outline + pure helpers),
`src/app/book-page/book-page.ts`, and `src/app/books/library.ts`. Match their feel.

- **Top-down "table of contents"**: keep entry functions and methods short so they read like an outline; put detailed
  steps (parsing, filtering, error mapping, stream decoding) in named pure functions below in the same file. This also
  keeps logic easy to unit-test in Vitest without `TestBed`.
- **Component state without extra layers**: keep view state (`signal`, `computed`, `resource`) directly in the
  component. Do NOT add a local `ViewStore` or facade service for a single view.
- **No flag-driven mega-components**: prefer two flat, straight-line components (e.g. `AddBookSheet` and
  `EditBookSheet`) over one component switching on `mode: 'add' | 'edit'` / `isEdit`. Share only genuinely identical
  inner form pieces when needed.
- **Focused templates & subcomponents**: when a template mixes distinct concerns (e.g. API-key setup + chat stream),
  extract subcomponents so the parent template reveals its layout in one glance.
- **Separate files by default**: use separate `.ts`, `.html`, and `.scss` files whenever `.ts` has its own logic (even
  if the HTML is 5 lines). Inline `template` (and `styles`) ONLY when the `.ts` class would otherwise be practically
  empty (just `@Component` + 1–2 `input()`/`output()`, no real logic).
- **Readable transforms**: prefer declarative steps over imperative loops, but avoid hard-to-scan `.reduce()` calls
  that mutate an accumulator object; split multi-step transforms into named pure functions. Destructure input objects
  in parameters when it cuts repetitive `raw.x` noise.
- **Errors**: throw `Error` (or a small domain subclass like `NotAnEpubError`) and catch at the UI boundary. Do NOT
  wrap expected failures in `{ ok: true } | { ok: false }` Result objects.
- **Maximum TypeScript inference**: strict mode, never `any` (use `unknown` when uncertain). Omit `: void`, obvious
  `: Promise<...>` return types, and local variable types whenever TS infers them safely. Keep explicit types on
  parameters, domain models, and empty `signal<T>()` / `input<T>()`.
- **Plain, descriptive names over comments**: use clear, everyday English names (avoid obscure jargon like `clamp` —
  prefer `limitRating` / `normalizeRating`). Add comments only for a non-obvious "why" (browser quirk, memory rule,
  product decision) that a name cannot convey.
- **Simplify pass before done**: after tests pass, review `git diff` (using `review-readability`) to flatten needless
  indirection, break up long methods/templates, and drop unused signals, `viewChild` refs, or imports.

## Angular 22 & Accessibility
- Standalone and `OnPush` are defaults in Angular 20+/22+: do NOT set `standalone: true` or
  `changeDetection: ChangeDetectionStrategy.OnPush`.
- Use `inject()`, `@Service()` for root singletons, lazy-loaded feature routes, and signal APIs (`signal`, `computed`,
  `linkedSignal`, `resource`, `input()`, `output()`, `model()`). Update signals with `set`/`update`, never `mutate`.
- Put host bindings in the decorator's `host` object (never `@HostBinding`/`@HostListener`).
- Use native control flow (`@if`, `@for`, `@switch`), `[class.*]`/`[style.*]` bindings (never `ngClass`/`ngStyle`),
  and import only the directives/pipes used (never `CommonModule`). Use relative paths for `templateUrl`/`styleUrl`.
- Prefer Signal Forms (`@angular/forms/signals`) for new forms; otherwise Reactive Forms (not template-driven).
- Use `NgOptimizedImage` for static images (not inline base64). Do not assume globals like `new Date()` in templates.
- Meet WCAG AA minimums (contrast, focus management, ARIA) and pass AXE checks.
