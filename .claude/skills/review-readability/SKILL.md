---
name: review-readability
description: >-
  Review and simplify Shelvve TypeScript/Angular diffs for human readability and
  minimal abstractions. Activate after tests pass on any non-trivial change, or
  when reviewing a branch before merge.
---

# Shelvve Readability & Simplify Review

Run this pass on `git diff` (ideally with fresh eyes or in a review subagent) after
behavior and tests are green. Goal: make the code effortless for an Angular developer
to read top-to-bottom without adding unnecessary layers.

Compare new code against the repo's gold-standard files:
- `src/app/books/epub/read-epub.ts` (top-down outline + pure helpers below)
- `src/app/book-page/book-page.ts` and `src/app/books/library.ts`

## Checklist

1. **Top-down "table of contents"**
   - Does any method or function exceed ~35–40 lines by mixing orchestration with low-level details (parsing, error mapping, stream decoding, multi-step filtering)?
   - If yes: keep the entry method short and move each detail step into a named pure function below in the same file (and unit-test the pure function directly in Vitest if non-trivial).

2. **Templates & subcomponents**
   - Does a template mix separate responsibilities (e.g., setup/settings form + main view) or become hard to scan in one glance?
   - If yes: extract a focused subcomponent so the parent template reads like a layout outline.

3. **File layout (separate vs inline)**
   - Any component with logic in `.ts` should use separate `.ts`, `.html`, and `.scss` files (even for short 5-line HTML).
   - Inline `template`/`styles` ONLY when the `.ts` class would otherwise be practically empty (`@Component` + 1–2 `input()`/`output()`, no real logic).

4. **No needless abstractions or mode flags**
   - Flag any local `ViewStore`/facade created for a single component (move signals back into the component, keep pure helpers outside).
   - Flag any component/function branching on `mode: 'add' | 'edit'` or `isEdit` — split into two flat, straight-line components instead.
   - Flag any `{ ok: true } | { ok: false }` Result wrappers where throwing an `Error` + `try/catch` is simpler.

5. **Clean TypeScript & naming**
   - Drop redundant return type annotations (`: void`, obvious `: Promise<...>`) and local variable annotations that TS infers safely.
   - Replace dense `.reduce()` calls that mutate an accumulator object with clear, named pure steps.
   - Replace obscure jargon (e.g. `clamp`) or terse names needing comments with plain, descriptive everyday English. Keep comments only for non-obvious "why".
   - Remove unused `signal`, `computed`, `viewChild`, parameters, or imports.

## Output format (when reviewing)
Group findings into:
- **Must simplify** (violates the rules above or hides a bug),
- **Optional polish** (minor naming/clarity tweaks),
then apply the safe simplifications and re-run `npm run test:once` and `ng build`.
