# Agent Instructions

## Bun Usage

Default to using Bun for package management, scripts, tests, local server code,
and CLI code.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`.
- Use `bun test` through the repository scripts instead of Jest or Vitest.
- Use `bun install` instead of `npm install`, `yarn install`, or `pnpm install`.
- Use `bun run <script>` instead of `npm run <script>`, `yarn run <script>`, or
  `pnpm run <script>`.
- Use `bunx <package> <command>` instead of `npx <package> <command>`.
- Bun automatically loads `.env`, so do not add `dotenv`.

### Runtime APIs

- Prefer Bun/Hono web-standard `Request` and `Response` patterns for the local
  authoring server.
- Do not add Express.
- Prefer `Bun.file` for Bun-owned server/script file reads when it is a clear
  fit.
- Keep Bun-specific APIs out of `packages/core` unless explicitly justified;
  `packages/core` should remain portable enough for future Node-compatible
  builds.

### Frontend

This project intentionally uses Vite for the React authoring UI.

- Use Vite in `apps/web`.
- Use shadcn/ui components for common controls instead of handcrafting custom UI
  primitives.
- Use CSS Grid and ordinary React components for the recommendation grid itself.
- Use `dnd-kit` only for grid/section reordering behavior that benefits from a
  proven drag-and-drop library.

## Project Overview

Gridgen is a Bun-first TypeScript monorepo for authoring and rendering static
recommendation grids for Jekyll blogs.

The product has two major surfaces:

- A local authoring UI served by `gridgen run`, built with Vite, React, and
  shadcn/ui.
- A CLI renderer that turns collection JSON and image assets into static,
  opinionated Jekyll includes, CSS, and optimized image assets.

The project prioritizes small, maintainable TypeScript modules, strict static
analysis, stable schema validation, clear boundaries around filesystem/image
side effects, and behavior tests through public APIs.

## Project Map

- `apps/web/`: Vite React authoring UI.
- `packages/core/`: Portable schema, validation, renderer, path, and image
  pipeline logic. Preview and build must share this package.
- `packages/server/`: Local Bun/Hono authoring server and API routes.
- `packages/cli/`: `gridgen` command entrypoints.
- `examples/`: Example source collections and Jekyll output fixtures.
- `tests/`: Unit, integration, fixture, and future end-to-end tests.
- `scripts/`: Repository maintenance and validation scripts when needed.
- `coverage/`, `dist/`, and generated Jekyll output fixtures: Generated output.
  Do not edit by hand.
- `DESIGN.md`: Architecture, boundaries, workflows, and implementation
  rationale.
- `CHECKLIST.md`: Milestone-level work tracking.

## Quality Gate

When making code changes, run the project QA tooling before handoff and fix any
issues it reports. Use repository scripts instead of ad hoc command wrappers so
failures are visible and reliable.

For normal code changes, `bun run check` is the expected baseline.

Available QA scripts:

- `bun run typecheck`: TypeScript static checks for package, tooling, and Vite
  configs.
- `bun run lint`: ESLint with warnings treated as errors, JSDoc rules, security
  rules, import sorting, and unused-disable checks.
- `bun run lint:fix`: ESLint safe autofixes.
- `bun run format`: Prettier formatting check.
- `bun run format:write`: Prettier formatting write.
- `bun run fix`: ESLint autofix followed by Prettier formatting.
- `bun run deadcode`: Knip unused files, dependencies, and exports analysis.
- `bun run test`: Bun unit tests. Passing with no tests is allowed only during
  initial scaffolding before behavior code exists.
- `bun run coverage`: Bun tests with coverage.
- `bun run build`: Vite production build for the authoring UI.
- `bun run audit`: Dependency vulnerability audit.
- `bun run secrets`: Gitleaks repository secret scan.
- `bun run check`: Normal pre-handoff gate for code changes.
- `bun run check:release`: Stricter release gate including coverage, audit, and
  secret scanning.

## Coding Policy

This project's TypeScript policy is intentionally strict, with project tooling
as the source of truth.

Core principles:

- Prefer simple, explicit, maintainable code over clever abstractions.
- Preserve existing module boundaries unless there is a clear reason to change
  them.
- Keep changes narrowly scoped and avoid unrelated refactors.
- Use `const` by default and `let` only when reassignment is required.
- Keep exports intentional and minimal; do not expose implementation details for
  convenience.
- Keep dead code out of the project: remove unused variables, functions, files,
  dependencies, and exports rather than leaving them for possible future use.
- Use named exports only.
- Avoid namespace/container classes; use modules, functions, and constants for
  organization.
- Preserve strict type safety: avoid `any`, parse `unknown` at boundaries, and
  do not use unsafe assertions unless a documented invariant justifies them.
- Prefer patterns that let TypeScript and ESLint catch future mistakes, such as
  exhaustive `switch` statements for finite enum/union handling.
- Avoid brittle code shapes where future changes can silently miss a case,
  duplicate rules, or bypass validation.
- Use constants for fixed values and enums for real finite state choices.
- Keep side effects behind narrow boundaries and keep pure logic easy to test.
- Treat expected domain failures as typed results; reserve thrown exceptions for
  exceptional failures.
- Throw `Error` instances, not strings or arbitrary values.
- Do not leave empty or silent `catch` blocks without an explanatory comment.
- Document every exported function, type, interface, enum, and class with useful
  JSDoc, except generated shadcn/ui component files.
- Use implementation comments only to explain intent, invariants, or
  non-obvious tradeoffs.

## Dependency And Security Policy

Do not add dependencies casually. Runtime dependencies require explicit
justification because they affect install weight, security, maintainability, and
long-term open-source support.

Prefer:

- Web platform APIs and Bun APIs where they fit cleanly.
- Existing project utilities before adding libraries.
- shadcn/ui and Radix-backed components for common UI controls.
- First-party renderer/layout code for project-specific recommendation grid
  behavior.

Do not add analytics, external services, remote-code loading, or user-data
collection without explicit approval.

Treat dependency vulnerability warnings as errors. Use `bun run audit` for
dependency vulnerability checks and `bun run secrets` for secret scanning. Any
exception must have an explicit documented justification and must be reported
during handoff for approval.

## Renderer And Preview Policy

Preview and build output must use the same renderer code path.

- `gridgen build` writes static Jekyll-ready assets.
- The authoring UI preview must call the same renderer through the local server.
- Do not maintain a separate preview-only rendering implementation.
- Rendered output should be static HTML, CSS, and images by default.
- Rendered CSS must be namespaced with `gridgen`-prefixed classes.
- Generated Jekyll includes and assets must avoid remote resources by default.
- Generated output must be deterministic for identical input.

## Checklist Workflow

Use `CHECKLIST.md` to track product, design, implementation, documentation, and
verification milestones. The checklist should describe what must be true for a
milestone to be complete, not every routine command an agent might run.

Before starting a non-trivial change, add or update a milestone with granular,
behavior-focused items. Keep items specific enough that completion can be
reviewed later. Mark items complete as they are finished, and keep the checklist
current when scope changes.

Do not use the checklist as a replacement for QA. Routine tooling expectations
belong in this `AGENTS.md` file; only add explicit checklist items for
verification work that is materially part of the milestone.

## Testing Policy

Test behavior through intended public APIs. Do not export implementation details
only to make tests easier. Test-only exports require explicit user permission.
If a test seems to require a private helper, first reconsider the module
boundary and separate stable logic from side-effect-heavy edge code.

Aim for useful coverage. Coverage must come from meaningful behavior tests, not
weakened runtime code, brittle assertions, or leaky public interfaces. Any
coverage exception must be explicitly justified in a nearby code comment and
reported during handoff.

For UI work, prefer tests that assert user-visible behavior. Use Playwright for
full authoring flows once the local server and editor are in place.
