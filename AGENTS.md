# Repository Guidelines

This monorepo contains the 3D editor engine and related apps.

## Project Structure & Modules
- `apps/demo-vue3`: Example Vue 3 application consuming the engine.
- `packages/engine`: Core rendering kernel and editor logic.
- `packages/extensions`: Optional extensions / plugins to the core engine.
- `docs`: Architecture notes, feature designs, and debug diaries.

## Build, Test & Development
- Install: `pnpm install` (Node ≥18, pnpm ≥8).
- Dev (all apps): `pnpm dev` → runs `turbo run dev`.
- Build: `pnpm build` → builds all packages/apps.
- Test: `pnpm test` → runs `turbo run test` (Vitest in workspaces).
- Lint: `pnpm lint` → ESLint over TypeScript/JavaScript.
- Format: `pnpm format` → Prettier over `*.{ts,tsx,js,jsx,vue,md,json}`.
- Docs: `pnpm docs:dev` / `pnpm docs:build` from the repo root.

## Coding Style & Naming
- Language: TypeScript-first; prefer strict types, avoid `any` where practical.
- Formatting: Prettier config in `.prettierrc.js` (2 spaces, no semicolons, single quotes).
- Linting: ESLint config in `.eslintrc.js`; fix warnings before submitting.
- Naming: `camelCase` for variables/functions, `PascalCase` for types/classes/components, `kebab-case` for file and directory names in apps/components.

## Testing Guidelines
- Framework: Vitest per package/app; colocate tests near source or under a `tests` folder following local patterns.
- Naming: Use `*.test.ts` / `*.spec.ts`.
- Expectations: Add or update tests for new features and bug fixes; keep coverage roughly in line with surrounding code.

## Commits & Pull Requests
- Commits: Keep messages imperative and focused (e.g., `add transform controls`, `fix selection bounding box`).
- PRs: Include a clear description, screenshots/GIFs for UI changes (especially in `apps/demo-vue3`), and reference related issues if applicable.
- CI: Ensure `pnpm lint` and `pnpm test` pass before opening or merging PRs.

## Agent-Specific Notes
- Respect this file’s guidance for any changes under the repo root.
- Prefer minimal, focused diffs and avoid mass formatting outside the scope of the task.

