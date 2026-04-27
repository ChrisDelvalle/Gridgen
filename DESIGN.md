# Design

Gridgen is a Bun-first TypeScript tool for creating, editing, previewing, and
building static recommendation grids for Jekyll blogs. This document is the
developer-facing architecture guide. It should explain where code belongs, which
boundaries must stay stable, and how to extend the project without weakening
type safety or long-term maintainability.

The core design idea is simple: keep domain logic pure and deterministic, keep
messy work at the edges, and use types plus validation so invalid state is hard
to represent.

## Product Shape

Gridgen has two user-facing workflows:

1. `gridgen run`
   Starts a local authoring server and serves a Vite React UI. The UI lets a
   user create collections, edit sections, add items, upload images, save, and
   preview the final rendered grid.

2. `gridgen build <source> <jekyll-site>`
   Reads saved collection JSON and image assets, then writes static
   Jekyll-ready output: Liquid includes, namespaced CSS, and optimized images.

The rendered output should be boring, portable static assets. A Jekyll user
should be able to include a generated grid with a line like:

```liquid
{% include gridgen/music.html %}
```

The authoring UI should look like the thing it creates: a collection containing
sections, and each section containing a responsive grid of recommendation item
tiles.

## User Journeys

These journeys describe the intended UX. They are not test scripts, but they
should guide product behavior and later Playwright coverage.

### Journey: First Local Run

1. The user runs `gridgen run`.
2. The CLI starts a local server bound to loopback and prints the authoring URL.
3. If `./gridgen` does not exist, the UI shows an empty state with a clear
   create-collection action.
4. The user creates a collection named "Music".
5. Gridgen creates a draft collection with a stable `music` ID and one starter
   section.
6. The editor opens directly; there is no marketing page or dashboard detour.

The empty state should make the next action obvious without explaining the
entire product.

### Journey: Create And Save A Collection

1. The user edits the collection title in the top bar.
2. The user renames the starter section inline, such as "S Tier".
3. The user clicks the add-item tile.
4. The item editor opens in a right-side sheet.
5. The user enters title, description, and link.
6. The user uploads an image and accepts the default square crop.
7. The user saves.
8. The UI shows saved status after the server returns the persisted snapshot.

Save should be explicit. Unsaved changes should be visible but not noisy.

### Journey: Adjust Image Crop

1. The user opens an item with an existing source image.
2. The user clicks the image preview or crop action.
3. A shadcn surface opens with `react-easy-crop` inside a square crop frame.
4. The user drags the image and adjusts zoom with a shadcn `Slider`.
5. The user confirms the crop.
6. The UI stores crop percentages in draft state and updates the tile preview.
7. The original uploaded source image remains available for future crop edits.

Version 1 does not expose rotation.

### Journey: Preview Final Output

1. The user clicks Preview.
2. The server validates the current collection as renderable.
3. If required fields are missing, the UI shows field-level errors.
4. If valid, the server renders through `packages/core`.
5. The preview opens as a full route, such as
   `http://localhost:<port>/preview/music`.
6. The preview uses the same HTML/CSS renderer as `gridgen build`.

Preview must not be a React approximation of the final output.

### Journey: Build For Jekyll

1. The user saves the collection in the authoring UI.
2. The user runs `gridgen build ./gridgen ./my-jekyll-blog`.
3. The CLI discovers every JSON file in `./gridgen/collections`.
4. Gridgen validates collections and source asset references before writing.
5. Gridgen writes `_includes/gridgen/<collection-id>.html`.
6. Gridgen writes `assets/gridgen/gridgen.css`.
7. Gridgen writes generated WebP images under
   `assets/gridgen/<collection-id>/`.
8. The user adds `{% include gridgen/music.html %}` to a Jekyll page or post.

The build command should report what it wrote and make validation failures
actionable.

## Goals

- Provide a straightforward local authoring tool for recommendation grids.
- Produce deterministic, self-contained Jekyll output.
- Keep rendered grids static by default: HTML, CSS, and images, with no
  JavaScript requirement.
- Use strict TypeScript and runtime validation to make invalid state difficult
  to construct.
- Keep pure collection, section, item, path, and rendering rules easy to test.
- Keep filesystem, image-processing, HTTP, browser, and DOM side effects behind
  narrow boundaries.
- Prefer first-party project logic for domain-specific behavior and established
  dependencies for infrastructure where they clearly help.
- Keep dependencies minimal and add them only when code uses them.

## Non-Goals

- Gridgen is not a general CMS.
- Gridgen is not a hosted service.
- Gridgen should not require a Jekyll site to run JavaScript for the rendered
  grid.
- Gridgen should not couple authoring state to one specific blog repository
  layout beyond the explicit build destination.
- Gridgen should not support arbitrary user-defined schemas in the first
  version. Optional metadata can be added carefully after the core model is
  stable.
- Gridgen should not introduce analytics, telemetry, remote code loading, or
  external services without explicit approval.

## Design Principles

### Make Invalid State Impossible

Use branded IDs, discriminated unions, required fields, normalized paths, and
validated parsed data so illegal states cannot quietly flow through the system.

Examples:

- A collection has at least one section after creation.
- Section IDs are stable and unique within a collection.
- Item IDs are stable and unique within a collection.
- Saved item links are validated URLs or explicitly empty draft values inside
  authoring state.
- Image references are normalized asset references, not arbitrary unchecked
  filesystem paths.
- Renderable collections must be stricter than draft collections.

Do not rely on UI controls alone to enforce invariants. Parse and validate data
at every external boundary.

### Parse At Boundaries

All untrusted or external data starts as `unknown`:

- JSON read from disk.
- HTTP request bodies.
- multipart upload metadata.
- CLI arguments.
- browser-provided file details.

Boundary code validates and converts raw data into domain types before calling
pure logic. Pure logic should not repeatedly defend against raw JSON shapes.

### Keep Effects At The Edges

The following operations are edge effects:

- Reading and writing files.
- Scanning directories.
- Processing images.
- Serving HTTP requests.
- Opening local URLs.
- Rendering React components.
- Reading browser file inputs.
- Writing Jekyll output.

Edge modules may be messy because real systems are messy, but they must convert
that mess into stable typed values before calling domain modules.

### One Renderer, Two Consumers

Preview and build must use the same renderer.

```text
Authoring UI preview
  -> local server preview route
  -> packages/core renderer

CLI build command
  -> packages/core renderer
```

There must not be a separate preview-only renderer in the React app. If preview
looks different from `gridgen build`, the architecture has failed.

### Deterministic Output

Given the same valid source collection and assets, build output should be
stable:

- same include name
- same asset paths
- same generated CSS
- same rendered markup
- same image processing choices

Stable output makes tests reliable, diffs reviewable, and user trust easier to
maintain.

## Project Structure

```text
apps/
  web/
    src/
      app/                 Application composition and route-level UI.
      components/          App-specific React components.
      components/ui/       shadcn/ui generated components.
      features/            Feature-level UI modules.
      lib/                 Browser-safe helpers and API client code.

packages/
  core/
    src/
      build/               Build planning and generated file manifests.
      collection/          Collection, section, item domain model.
      errors/              Shared typed error codes and failure structures.
      api/                 Browser-safe HTTP DTOs and API contract types.
      schema/              Runtime validation and parse functions.
      render/              Static grid HTML/CSS rendering.
      paths/               Slug, output path, and asset path rules.
      assets/              Pure image asset planning.
      result/              Shared result/error helpers if needed.
      index.ts             Intentional public exports.

  io/
    src/
      assets/              Sharp-backed image processing edge code.
      build/               Atomic generated-output writers.
      workspace/           Source workspace reads, writes, and trash behavior.
      index.ts             Filesystem/image public entrypoint.

  server/
    src/
      api/                 HTTP routes and request/response DTO parsing.
      security/            Localhost origin/session-token safeguards.
      preview/             Preview route using the core renderer.
      index.ts             Server public entrypoint.

  cli/
    src/
      commands/            `run`, `build`, `validate`, future `init`.
      output/              CLI output helpers; console access belongs here.
      index.ts             CLI public entrypoint.

examples/
  sample-grid/             Example source collection and image fixtures.
  jekyll-site/             Example generated Jekyll integration target.

tests/
  fixtures/                Shared test inputs.
  e2e/                     Future Playwright flows.

scripts/                   Repository tooling scripts.
```

This layout is aspirational where directories do not exist yet. Create folders
as milestones require them, not before.

## Package Boundaries

### `packages/core`

`core` owns stable product logic:

- build planning
- collection schema and parsed domain types
- collection operations
- error taxonomy and typed result helpers
- browser-safe HTTP DTOs and API contract types
- item and section ordering rules
- slug and ID normalization rules
- render planning
- static HTML and CSS generation
- Jekyll output path planning
- image asset planning

`core` should be pure and deterministic. It may plan filesystem and image work,
but it should not perform that work.

Allowed dependencies:

- validation library when schema work begins, expected: `zod`
- small utilities only with clear justification

Not allowed:

- React
- Vite
- Hono
- Commander
- Sharp
- direct DOM APIs
- direct filesystem writes
- direct CLI output
- ambient process/global state outside explicit edge adapters

### `packages/io`

`io` owns Bun/Node edge adapters used by both the CLI and local server:

- source workspace scanning
- collection JSON reads and atomic writes
- source image file storage
- authoring soft-delete/trash behavior
- Jekyll output writing
- generated asset directory writing
- Sharp-backed image processing

`io` depends on `core` for plans, validated types, and error structures. It
must not duplicate domain validation. If an IO function needs to know whether a
collection is renderable, that decision belongs in `core`.

Expected dependency when implemented: `sharp`.

### `packages/server`

`server` owns the local authoring API:

- start the localhost server
- serve the built or development UI
- parse HTTP request bodies
- handle upload endpoints
- call `io` for workspace persistence and image processing
- call `core` for validation, normalization, preview, and render planning
- return typed response DTOs to the UI

The server should not duplicate domain rules. If an API route knows how to
validate a collection in a way that `core` does not, that validation belongs in
`core`.

Expected dependency when implemented: `hono`.

### `packages/cli`

`cli` owns command-line wiring:

- parse command arguments
- choose source and destination paths
- start the server for `gridgen run`
- call build and validate operations
- print human-readable output
- set process exit codes

The CLI should be thin. Command modules coordinate, but domain decisions belong
in `core` and HTTP/server behavior belongs in `server`.

Expected dependency when implemented: `commander`.

### `apps/web`

`web` owns the browser authoring UI:

- collection editor screen
- section grid UI
- item editor sheet
- image upload controls
- save and preview actions
- dirty/saved status
- client API calls to the local server

The UI may represent draft state that is not yet renderable, but render/build
requests must pass through server/core validation. UI-only draft convenience
types should stay clearly separate from persisted collection types.

Expected UI approach:

- Vite + React
- shadcn/ui for common controls
- CSS Grid for recommendation-grid layout
- `dnd-kit` only when reorder behavior is implemented

The UI should not write files directly, process images directly, or contain a
copy of the static renderer.

Use shadcn/ui for these expected controls:

- `Button` for save, preview, add item, add section, confirm, and cancel actions
- `Input` for collection title, section name, item title, item link, and alt text
- `Textarea` for item description
- `Label` for editor form fields
- `Sheet` for the item editor
- `Dialog` for create collection and crop editor flows
- `AlertDialog` for destructive confirmations
- `DropdownMenu` for section/item overflow actions
- `Tooltip` for icon-only actions
- `Slider` for image zoom
- `Sonner` or shadcn toast equivalent for save/preview/build feedback
- `Separator` for simple panel grouping

Do not handcraft these generic primitives unless shadcn does not provide the
needed behavior.

## Dependency Direction

Dependencies should flow inward:

```text
apps/web        -> HTTP API DTOs from packages/core only
packages/cli    -> packages/server, packages/io, packages/core
packages/server -> packages/io, packages/core
packages/io     -> packages/core
packages/core   -> no project package dependencies
```

Avoid circular dependencies. If two modules need shared types, move those types
toward `core` or define an API DTO in the narrow boundary that owns the
exchange.

The browser app must not import `packages/server` or `packages/io`. Shared API
request/response DTOs should be browser-safe exports from `packages/core`.

## Data Model

There are two closely related models:

1. Draft collection state for the authoring UI.
2. Renderable collection state for preview/build.

The saved JSON format should remain human-readable and stable. A starting
schema:

```json
{
  "schemaVersion": 1,
  "id": "music",
  "title": "Music",
  "sections": [
    {
      "id": "s-tier",
      "name": "S Tier",
      "items": [
        {
          "id": "album-a",
          "title": "Album A",
          "description": "Optional short text.",
          "link": "https://example.com/a",
          "image": {
            "type": "file",
            "sourceFileName": "album-a.jpg",
            "alt": "Album A cover",
            "crop": {
              "unit": "percent",
              "x": 0,
              "y": 0,
              "width": 100,
              "height": 100
            }
          }
        }
      ]
    }
  ]
}
```

`schemaVersion` is required from the first persisted format. Version 1 is the
initial schema. Future schema changes must add explicit migration functions
rather than silently accepting multiple shapes throughout the codebase.

### Collection

A collection represents one recommendation grid and one generated include.

Required persisted fields:

- `schemaVersion`
- `id`
- `title`
- `sections`

Invariants:

- `id` is stable, slug-safe, and unique within the source workspace.
- `title` is non-empty after normalization.
- `sections` preserves user-defined order.
- persisted JSON uses deterministic object shapes and stable ordering.

### Section

A section groups related recommendation items.

Required persisted fields:

- `id`
- `name`
- `items`

Invariants:

- `id` is stable and unique within a collection.
- `name` is non-empty for renderable collections.
- `items` preserves user-defined order.

### Item

An item is one recommendation tile.

Required renderable fields:

- `id`

Optional renderable fields:

- `title`
- `description`
- `link`
- `image`

Invariants:

- `id` is stable and unique within a collection.
- `title`, when present after normalization, is non-empty.
- `link` is either an absolute URL, a root-relative path such as
  `/albums/example/`, or a Jekyll-relative path that does not attempt path
  traversal. Empty links are represented as absent renderable links.
- `image`, when present, points to a project-owned asset, not an arbitrary
  absolute path.
- `description` is plain text, not HTML.

### Image Reference

Image references should be discriminated unions so future sources can be added
without weakening file safety.

Initial supported variant:

```ts
type GridImage = {
  type: "file";
  sourceFileName: string;
  alt?: string;
  crop: ImageCrop;
};
```

`sourceFileName` references the sanitized uploaded source image inside the
collection's source asset folder. It is not the generated WebP output file name.
Generated output image names should be derived by build planning, usually from
the stable item ID.

Crop metadata is persisted as percentages relative to the source image:

```ts
type ImageCrop = {
  unit: "percent";
  x: number;
  y: number;
  width: number;
  height: number;
};
```

Percentage crop metadata is stable across image display sizes and can be
converted to pixels by the Sharp processing edge during preview/build. Validate
crop values so the crop rectangle is finite, positive, and inside the source
image.

Possible future variants:

- `type: "remote"` for remote image ingestion
- `type: "generated"` for generated placeholder assets

Do not add variants until there is a real workflow and validation plan for
them.

### Link Reference

Item links should be parsed into an explicit domain type before rendering:

```ts
type GridLink = { type: "absolute"; href: string } | { type: "site"; href: string };
```

`absolute` links are normal `http:` or `https:` URLs. `site` links are local
Jekyll/blog paths. Both render as link `href` values after escaping, but parsing
them separately prevents ad hoc URL checks throughout the codebase.

Reject:

- `javascript:` URLs
- protocol-relative URLs unless explicitly supported later
- paths containing traversal segments

### Schema Versioning And Migrations

Versioned parsing should live in `packages/core/schema`.

Rules:

- Current persisted collections require `schemaVersion: 1`.
- Unknown future schema versions fail with a structured unsupported-version
  error.
- Older supported versions are migrated by explicit pure migration functions.
- Migration functions must be deterministic and covered by fixture tests.
- Application code should operate on the current domain model, not on every
  historical persisted shape.

The authoring server may offer a future "migrate on save" behavior, but silent
destructive migrations during read should be avoided.

## Draft Versus Renderable State

The authoring UI needs drafts. A user may create an item before filling in a
title, link, description, or image. Build output preserves that choice by
omitting absent item fields rather than forcing placeholder content into the
rendered grid.

Use separate parse paths:

- `parseDraftCollection(unknown)` accepts valid saved authoring state.
- `parseRenderableCollection(unknown)` or `toRenderableCollection(draft)`
  enforces stricter build/preview requirements.

Validation errors should be structured enough for the UI to highlight a field,
not just print a generic message.

## Result And Error Design

Expected domain failures should be typed results, not thrown exceptions.

Examples of expected failures:

- invalid collection JSON
- duplicate section ID
- invalid item URL
- unsafe output path
- unsupported image type

Exceptional failures may throw:

- impossible invariant violation after successful parsing
- dependency bugs
- programmer errors

A simple project result shape can be introduced when needed:

```ts
type Result<Value, Failure> = { ok: true; value: Value } | { ok: false; error: Failure };
```

Do not use stringly typed errors across package boundaries. Use discriminated
error codes with contextual fields.

### Error Taxonomy

Use stable error categories so CLI output, server responses, and UI field
messages can be derived from the same failures.

Initial categories:

- `collection.invalidJson`
- `collection.unsupportedSchemaVersion`
- `collection.duplicateId`
- `collection.emptyTitle`
- `section.emptyName`
- `item.invalidLink`
- `asset.missingFile`
- `asset.tooLarge`
- `asset.invalidCrop`
- `asset.unsupportedType`
- `asset.processingFailed`
- `server.unauthorized`
- `path.unsafe`
- `path.outsideRoot`
- `render.notRenderable`
- `filesystem.readFailed`
- `filesystem.writeFailed`

Errors should carry enough context to be useful:

- collection ID
- section ID
- item ID
- JSON path or logical field path
- source/destination path when safe to display

Do not expose raw stack traces or unreviewed absolute filesystem paths through
the browser UI.

## Public Core API Sketch

`@gridgen/core` should expose a small intentional API. Names may change during
implementation, but the shape should stay close to this:

```ts
export function parseDraftCollection(input: unknown): Result<DraftCollection, GridgenError>;

export function toRenderableCollection(
  collection: DraftCollection
): Result<RenderableCollection, GridgenError>;

export function parseRenderableCollection(
  input: unknown
): Result<RenderableCollection, GridgenError>;

export function createCollectionDraft(input: CreateCollectionInput): DraftCollection;

export function updateCollection(
  collection: DraftCollection,
  operation: CollectionOperation
): Result<DraftCollection, GridgenError>;

export function planJekyllBuild(input: JekyllBuildInput): Result<JekyllBuildPlan, GridgenError>;

export function renderGridHtml(input: RenderGridInput): string;

export function renderGridCss(input: RenderGridCssInput): string;

export function normalizeSlug(input: string): Result<Slug, GridgenError>;

export function planImageAsset(input: ImageAssetInput): Result<ImageAssetPlan, GridgenError>;
```

Important constraints:

- Parse functions accept `unknown`.
- Pure functions accept domain types.
- Build planning returns a manifest; it does not write files.
- Render functions return strings; they do not read files.
- Filesystem and image writers live in `packages/io`.

## ID, Slug, And Path Rules

IDs and filesystem paths are security-sensitive because build output writes
into a user-selected Jekyll site.

Rules:

- Collection IDs are slug-safe.
- Section and item IDs are stable and slug-safe.
- Slugs are generated by one core function, not ad hoc string manipulation.
- User-provided file names are normalized before persistence.
- Build paths are planned before writing any files.
- Path traversal is rejected.
- Absolute source paths are allowed only at CLI/server edge boundaries.
- Persisted JSON should store relative asset references, not absolute paths.

Jekyll output should target:

```text
<jekyll-site>/
  _includes/
    gridgen/
      <collection-id>.html
  assets/
    gridgen/
      gridgen.css
      <collection-id>/
        <item-image>.webp
```

The exact paths should be produced by `core` path-planning functions so tests
can lock them down.

Generated includes should reference the shared stylesheet:

```html
<link rel="stylesheet" href="{{ '/assets/gridgen/gridgen.css' | relative_url }}" />
```

Per-collection CSS should not be emitted in version 1 unless a later milestone
adds collection-specific theming.

## Output Ownership And Atomic Writes

Gridgen may overwrite files only inside Gridgen-owned output paths:

- `_includes/gridgen/`
- `assets/gridgen/`

Generated text files should include a short marker comment:

```html
<!-- Generated by gridgen. Do not edit by hand. -->
```

CSS should include an equivalent comment header.

Write policy:

- Plan every output path before writing any file.
- Reject unsafe or outside-root paths before writing any file.
- Write text output to temporary files in the destination directory and rename
  into place.
- Process/copy image assets to temporary files and rename into place.
- Do not delete non-Gridgen files.
- Do not overwrite files outside the Gridgen-owned directories.
- A build may remove stale files inside `assets/gridgen/<collection-id>/` for
  the collection it is currently rebuilding, because that directory is
  Gridgen-owned generated output.
- A build should not remove generated files for unrelated collections unless a
  future explicit clean command is added.
- If a build fails partway through, report which files may have been touched.

This policy keeps repeated builds convenient while avoiding broad destructive
behavior in a user's blog repository.

## Authoring Workflow

Primary UI shape:

```text
Top bar
  Collection title
  New collection
  Save
  Preview
  Dirty/saved status

Main editor
  Section title, inline editable
  CSS-grid item tiles
  Add item tile
  Add section button

Right sheet
  Item editor
  Image upload/preview
  Title
  Description
  Link
  Remove item
```

The UI should be direct and work-focused. It is an authoring tool, not a
marketing page.

Version 1 authoring UI should save and preview. It should not require direct
Jekyll build integration inside the browser. A future build/export control may
be added if `gridgen run` is launched with an explicit Jekyll destination, but
the first stable workflow remains save in the UI, then build through the CLI.

### Save Flow

```text
UI draft state
  -> client API request
  -> server parses request DTO
  -> core validates draft collection
  -> server writes JSON and assets
  -> server returns saved collection snapshot
```

The UI should treat the server response as the saved source of truth after a
successful save.

### Image Upload Flow

```text
Browser file input
  -> server upload route
  -> server validates upload metadata
  -> io stores sanitized source image in the source workspace
  -> default crop metadata is created
  -> image reference returned to UI
  -> UI attaches asset reference to item draft
```

The upload flow stores a sanitized source image, not the final generated Jekyll
thumbnail. Preview/build processing turns that source image plus crop metadata
into the canonical WebP output. This keeps the authoring workspace editable and
lets the user adjust crop intent later without re-uploading.

Initial image policy:

- Accept common raster inputs supported by the image processor.
- Reject uploads larger than 20 MB.
- Store sanitized source images under the collection asset folder.
- Generate 512 by 512 WebP thumbnails for preview/build output.
- Use square cover-style thumbnails by default.
- Use deterministic file names derived from collection/item IDs when possible.
- Reject path traversal and unsafe file names.
- Preserve enough metadata for accessible alt text.

The default crop behavior is cover/crop, not contain/pad. This matches the
album-grid style of the product and keeps the rendered grid visually stable.
Future item-level fit options may be added as a typed setting if real use cases
need them.

### Image Crop UI

Use `react-easy-crop` for the authoring crop UI when the image milestone lands.
It provides the profile-picture-style interaction this product needs: drag to
reposition, zoom controls, rotation support, fixed aspect ratios, and pixel crop
output.

The crop UI belongs in `apps/web` and should be wrapped with shadcn/ui surfaces
and controls:

- shadcn `Dialog` or `Sheet` for the crop editor surface
- shadcn `Slider` for zoom
- square crop area with `aspect={1}`
- crop intent saved as typed metadata

Do not expose rotation in version 1. Keep the implementation shape compatible
with future rotation metadata, but hide the control until a real workflow needs
it.

The browser cropper should produce crop instructions. The canonical generated
asset should still be produced by the `packages/io` image pipeline with `sharp`.
Do not make browser canvas output the persisted source of truth.

### Preview Flow

```text
UI requests preview
  -> server validates renderable collection
  -> server calls core renderer
  -> server returns or serves preview HTML
```

Preview should be a full preview route where practical, such as:

```text
http://localhost:<port>/preview/<collection-id>
```

This makes responsive inspection natural and keeps preview behavior close to the
final generated include.

## Rendering Workflow

The renderer should be deterministic and side-effect free where possible.

Recommended split:

1. Parse and validate source JSON.
2. Convert draft collection to renderable collection.
3. Plan output paths.
4. Plan required image assets.
5. Render HTML string.
6. Render CSS string.
7. Edge writer copies/processes assets and writes files.

Pure renderer functions should accept typed inputs and return strings or render
plans. They should not read from or write to disk.

### Rendered HTML

Generated markup should:

- use semantic `section`, heading, list, and link structure where appropriate
- use escaped text only
- use project-owned image paths
- include alt text
- keep item tiles linked in an accessible way
- avoid inline event handlers
- avoid remote scripts
- avoid depending on the authoring UI bundle

### Rendered CSS

Generated CSS should:

- use namespaced `gridgen-*` classes
- use responsive CSS Grid
- avoid global element styling
- avoid theme-specific assumptions
- avoid resets that affect the host Jekyll theme
- keep layout stable across common viewport widths

The default output should be opinionated enough to look good without theme
integration, but conservative enough not to fight the blog.

### Renderer Contract

Version 1 renderer decisions:

- Emit one shared CSS file at `assets/gridgen/gridgen.css`.
- Emit one include per collection at `_includes/gridgen/<collection-id>.html`.
- Include the shared stylesheet link from each generated include.
- Keep the default include one-line usable even if that means repeated
  stylesheet links when multiple grids appear on one page. The CSS file should
  be small and cacheable.
- Default missing image alt text to the item title.
- Render sections in saved order.
- Render items in saved order.
- Render item descriptions only when present and non-empty after trimming.
- Use no JavaScript in generated output.
- Use no remote assets in generated output.

If a future option changes any of these behaviors, it should be expressed as a
typed renderer option and covered by tests.

## CLI Commands

Initial command plan:

```text
gridgen run [--source <dir>] [--port <port>] [--open]
gridgen build <source-file-or-dir> <jekyll-site>
gridgen validate <source-file-or-dir>
```

Future command:

```text
gridgen init [dir]
```

Command responsibilities:

- `run` starts the local server and serves the authoring UI.
- `run --open` opens the local authoring URL in the browser. Without `--open`,
  `run` prints the URL and leaves browser opening to the user.
- `build` writes Jekyll output. Given a single collection file, it builds that
  collection. Given a source workspace directory, it builds all collections in
  `collections/`.
- `validate` checks collection JSON and asset references without writing output.
- `init` creates a starter authoring workspace if that proves useful.

CLI commands should call package APIs. They should not contain collection
validation, render logic, or direct image rules.

## Server API Contract

The first local server API should be small and explicit. Route names can be
adjusted during implementation, but these capabilities should exist:

```text
GET    /api/collections
POST   /api/collections
GET    /api/collections/:collectionId
PUT    /api/collections/:collectionId
DELETE /api/collections/:collectionId
POST   /api/collections/:collectionId/assets
POST   /api/collections/:collectionId/validate
GET    /preview/:collectionId
```

Route responsibilities:

- API routes parse request bodies and path params at the boundary.
- API routes return structured error responses derived from `GridgenError`.
- Save routes persist draft collections.
- Validate routes report draft/renderable validation status without writing
  build output.
- Upload routes return normalized image asset references.
- Preview routes render through `packages/core`; they do not use React to
  approximate the static output.

The server should eventually serve the Vite dev server during development and
the built Vite app for installed usage, but that behavior should stay separate
from API route logic.

### Local Server Safety

The authoring server mutates local files, so local-only does not mean
unprotected.

Version 1 server safety rules:

- Bind to loopback only.
- Do not enable broad CORS.
- Validate `Origin` for mutating requests when the header is present.
- Use a per-run session token for mutating API requests.
- Enforce JSON and multipart body size limits.
- Enforce the 20 MB per-image upload limit before image processing.
- Return structured errors instead of raw exceptions.
- Do not expose raw absolute filesystem paths in browser responses unless they
  are already user-selected paths and safe to show.

These rules reduce the risk that another local webpage or process can drive the
authoring API unexpectedly.

## Source Workspace

The authoring source workspace should be portable. Version 1 uses this
structure:

```text
gridgen/
  collections/
    music.json
    movies.json
  assets/
    music/
      sources/
        album-a.jpg
    movies/
      sources/
        movie-a.png
  .trash/
    2026-04-25T150000Z-music/
      music.json
      assets/
        sources/
          album-a.jpg
```

This keeps all collection JSON files easy to scan while keeping image assets
grouped by collection. Persisted asset references must remain relative and
portable.

`gridgen run` should default to a local `./gridgen` source workspace unless the
user passes `--source <dir>`.

Authoring deletes should be soft deletes in version 1. Deleting a collection
moves its JSON and collection assets into `gridgen/.trash/<timestamp>-<id>/`
after confirmation. Generated Jekyll build output is different: it is generated
and may be overwritten freely inside Gridgen-owned output directories.

Collection scans must ignore `.trash/`.

## Testing Strategy

Tests should exercise public APIs and user-visible behavior.

### Unit Tests

Target pure logic first:

- collection parsing
- renderable validation
- ID and slug generation
- duplicate detection
- section/item operations
- output path planning
- HTML escaping
- CSS rendering
- deterministic render output

### Integration Tests

Target edge coordination:

- read source collection and validate assets
- build a fixture collection into a temporary Jekyll directory
- confirm expected include, CSS, and image asset paths
- confirm unsafe paths are rejected
- confirm preview and build use the same render output
- confirm oversized uploads are rejected before image processing
- confirm mutating server routes enforce local session/origin safeguards
- confirm stale generated files are handled only inside Gridgen-owned paths

### UI And E2E Tests

Use Playwright once the local server and editor exist:

- create a collection
- add a section
- add an item
- upload an image
- save
- preview
- build

Prefer assertions about visible behavior and generated output over brittle
component internals.

## Quality And Tooling

The repository is intentionally strict:

- Bun for package management, scripts, and tests.
- TypeScript strict mode.
- ESLint type-aware strict rules.
- JSDoc required for public exports.
- Prettier for formatting.
- Knip for unused files, exports, and dependencies.
- Bun audit for vulnerabilities.
- Gitleaks for secrets.

Normal code changes should pass:

```sh
bun run check
```

Release-oriented changes should also pass:

```sh
bun run check:release
```

During early scaffolding, no-test passes are allowed only until behavior code
exists. Once domain modules exist, they should have tests.

## Dependency Policy

Dependencies should be added when implementation code actually uses them.

Production dependencies expected by milestone:

- `zod`
  Used in `packages/core` for runtime schema parsing, draft/renderable
  validation, migration input validation, and browser-safe API DTO validation.
- `hono`
  Used in `packages/server` for the local HTTP API, preview routes, request
  parsing, route composition, and testable web-standard handlers.
- `commander`
  Used in `packages/cli` for `gridgen run`, `gridgen build`,
  `gridgen validate`, future `gridgen init`, help text, argument parsing, and
  exit behavior.
- `sharp`
  Used in `packages/io` for image metadata reads, crop/resize, WebP generation,
  and safe image processing during preview/build.
- `react-easy-crop`
  Used in `apps/web` only for the crop editor interaction: pan, zoom, fixed
  square crop, and crop-area output.
- shadcn/ui runtime dependencies
  Used in `apps/web` for reusable UI primitives. Install only the components
  needed by the active UI milestone. Expected primitives are listed in the
  authoring UI section.
- `dnd-kit`
  Used in `apps/web` for accessible item and section reordering once
  drag-and-drop is implemented. Reordering should still have non-drag actions
  where practical.

Development/test dependencies:

- Playwright
  Used for end-to-end authoring flows once the local server and editor exist.
  It is not a production dependency.

Do not keep planned dependencies installed only because they are planned. Knip
should remain useful and strict.

The 20 MB image upload limit should live behind an easily modifiable exported
constant, not as a magic number buried in route code.

## First Implementation Milestones

The preferred development order:

1. Core schema and domain types.
2. Core slug/path/result helpers.
3. Static renderer for one in-memory renderable collection.
4. Build planner for Jekyll paths.
5. `packages/io` workspace reader and safe generated-output writer.
6. CLI `validate` for fixture collections.
7. CLI `build` writing static include/CSS without image processing.
8. Image asset planning and Sharp-backed processing in `packages/io`.
9. Local server storage, upload, safety, and preview routes.
10. Vite authoring UI with create/edit/save/preview.
11. Image crop UI with `react-easy-crop`.
12. Reordering and richer UI ergonomics.

This order keeps pure logic ahead of UI/server complexity and gives tests useful
targets early.

## Security And Safety

Important safety areas:

- Path traversal in source asset references.
- Unsafe output writes into a Jekyll destination.
- Unescaped item text in rendered HTML.
- Remote URL handling.
- Uploaded image handling.
- Accidental inclusion of authoring-only JavaScript in static Jekyll output.

Default stance:

- Escape all rendered text.
- Reject unsafe paths.
- Keep generated CSS namespaced.
- Avoid remote assets unless explicitly supported later.
- Do not collect user data.
- Do not add network services beyond the local authoring server.

## Extension Points

The architecture should make these future changes possible without rewrites:

- optional item metadata such as year, creator, tags, or rating
- multiple rendered themes
- custom output file names
- bulk image import
- build all collections in a source workspace
- additional static-site-generator targets
- internal Jekyll links as an alternative to absolute URLs

Future options should be added through typed configuration and renderer options,
not by spreading conditional logic across UI, server, and CLI code.

## Version 1 Decisions

These decisions are settled for version 1:

- Image crop UI does not expose rotation.
- The 20 MB upload limit is a normal exported constant that can be changed in
  code.
- Trash cleanup is manual. Gridgen creates `.trash/` entries for authoring
  deletes, but does not automatically remove them.
