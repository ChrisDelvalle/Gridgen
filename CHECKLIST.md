# Checklist

Use this file for milestone-level tracking. Keep milestones behavior-focused and
reviewable. Routine QA commands are covered by `AGENTS.md`; this checklist is
for implementation work and definitions of done.

## Milestone 1: Design Baseline

- [x] Define the project purpose, goals, and non-goals.
- [x] Define package boundaries for `core`, `io`, `server`, `cli`, and `web`.
- [x] Define the separation-of-concerns policy for pure domain logic and edge
      effects.
- [x] Define the starting collection, section, item, image, crop, and link data
      model.
- [x] Define draft versus renderable collection validation expectations.
- [x] Define renderer, preview, CLI, source workspace, testing, and dependency
      policies.
- [x] Resolve version 1 image dimensions, crop mode, upload limit, browser open
      behavior, delete behavior, and trash cleanup behavior.
- [x] Select `react-easy-crop` for the authoring crop UI milestone.
- [x] Review the design for separation-of-concerns gaps and move filesystem,
      image processing, workspace persistence, and generated-output writing to a
      dedicated IO boundary.
- [x] Clarify that the authoring UI saves and previews in version 1 while Jekyll
      builds remain CLI-driven.
- [x] Add local authoring server safety requirements for loopback binding,
      origin checks, session tokens, and request size limits.
- [x] Document expected production dependencies and the specific project
      responsibilities each dependency owns.
- [x] Add concrete user journeys for first run, collection authoring, image
      cropping, preview, and Jekyll build.

## Milestone 2: Workspace Package Baseline

- [x] Add the `packages/io` workspace package with a public `src/index.ts`.
- [x] Ensure workspace package names match the design: `@gridgen/core`,
      `@gridgen/io`, `@gridgen/server`, `@gridgen/cli`, and `@gridgen/web`.
- [x] Configure workspace dependencies so `cli` can depend on `server`, `io`,
      and `core`; `server` can depend on `io` and `core`; `io` can depend on
      `core`; and `core` has no project package dependencies.
- [x] Keep all package public exports intentional through package `exports`
      fields.
- [x] Remove leftover Vite starter assets and placeholder UI that are no longer
      part of the product direction.
- [x] Add minimal package README or source comments only where needed to clarify
      package ownership.

## Milestone 3: Core Result And Error Model

- [x] Define the shared `Result<Value, Failure>` type.
- [x] Define the initial `GridgenError` discriminated union with all error codes
      listed in `DESIGN.md`.
- [x] Add helpers for constructing common validation, path, asset, filesystem,
      render, and server errors.
- [x] Ensure every error can carry safe contextual fields such as collection ID,
      section ID, item ID, field path, and safe display path.
- [x] Add a boundary-safe error serialization shape for CLI/server/UI use.
- [x] Keep raw exceptions and stack traces out of browser-facing error payloads.

## Milestone 4: Core Domain Types And Schema Parsing

- [x] Add `zod` to `@gridgen/core` when schema parsing implementation begins.
- [x] Define branded or otherwise constrained types for collection IDs, section
      IDs, item IDs, slugs, safe file names, and safe local links.
- [x] Define draft collection, renderable collection, section, item, image,
      crop, and link domain types.
- [x] Implement `parseDraftCollection(input: unknown)`.
- [x] Implement `toRenderableCollection(draft)`.
- [x] Implement `parseRenderableCollection(input: unknown)`.
- [x] Enforce `schemaVersion: 1` and reject unsupported schema versions with a
      structured error.
- [x] Reject duplicate section IDs and duplicate item IDs within a collection.
- [x] Reject renderable collections with empty titles, empty section names,
      empty item titles, missing images, or invalid links.
- [x] Validate image crop values as finite, positive percentage rectangles
      inside the source image coordinate space.
- [x] Validate item links as either `http:`/`https:` absolute URLs or safe
      site-local paths.
- [x] Keep schema migration functions explicit, pure, and isolated even if only
      version 1 exists initially.

## Milestone 5: Core Collection Operations

- [x] Implement collection creation from a title with a stable slug-safe
      collection ID.
- [x] Ensure a newly created collection has one starter section.
- [x] Implement section creation, rename, reorder, and remove operations.
- [x] Implement item creation, update, move, reorder, and remove operations.
- [x] Preserve stable IDs across title/name edits.
- [x] Return typed results for operations that can fail instead of throwing for
      expected domain errors.
- [x] Keep collection operations pure and independent from React, server, CLI,
      filesystem, and image processing.

## Milestone 6: Core Slug, Link, And Path Planning

- [x] Implement one canonical slug normalization function.
- [x] Implement safe file-name normalization for uploaded source image names.
- [x] Implement link parsing for absolute URLs and safe Jekyll/local paths.
- [x] Implement path traversal rejection for source asset references and output
      paths.
- [x] Implement source workspace path planning for `collections/`,
      `assets/<collection-id>/sources/`, and `.trash/`.
- [x] Implement Jekyll output path planning for `_includes/gridgen/`,
      `assets/gridgen/gridgen.css`, and `assets/gridgen/<collection-id>/`.
- [x] Ensure path planning returns a manifest and never writes files.
- [x] Ensure all planned output paths are inside the selected Jekyll root.

## Milestone 7: Core Static Renderer

- [x] Implement HTML escaping for all rendered text and attribute values.
- [x] Implement `renderGridHtml` for one renderable collection.
- [x] Render one include per collection with the generated-by marker comment.
- [x] Include the shared stylesheet link using Jekyll `relative_url`.
- [x] Render sections and items in saved order.
- [x] Render item descriptions only when present and non-empty after trimming.
- [x] Default missing image alt text to the item title.
- [x] Use only generated local image paths in rendered HTML.
- [x] Avoid JavaScript, inline event handlers, remote scripts, and remote image
      assets in generated output.
- [x] Implement `renderGridCss` with namespaced `gridgen-*` classes and
      responsive CSS Grid.
- [x] Keep renderer functions pure: no filesystem reads/writes and no image
      processing.

## Milestone 8: Core Build Planner

- [x] Implement `planJekyllBuild` for a single renderable collection.
- [x] Include planned HTML include output, shared CSS output, and generated image
      asset outputs in the build manifest.
- [x] Derive generated WebP image names deterministically from stable item IDs.
- [x] Plan stale generated-file handling only within
      `assets/gridgen/<collection-id>/`.
- [x] Ensure repeated build planning for the same input is deterministic.
- [x] Ensure the build planner can represent failures before any edge writer
      touches the filesystem.

## Milestone 9: IO Workspace And Atomic Writers

- [x] Add `@gridgen/io` workspace dependency on `@gridgen/core`.
- [x] Implement source workspace discovery for `collections/*.json`.
- [x] Ensure collection scans ignore `.trash/`.
- [x] Implement collection JSON read and parse handoff to `core`.
- [x] Implement atomic collection JSON writes through temporary files and rename.
- [x] Implement source image storage under `assets/<collection-id>/sources/`.
- [x] Implement authoring soft delete by moving collection JSON and collection
      assets into `.trash/<timestamp>-<collection-id>/`.
- [x] Implement generated Jekyll text output writes through temporary files and
      rename.
- [x] Implement generated asset directory writes only inside Gridgen-owned
      output directories.
- [x] Prevent writes outside selected source workspace and selected Jekyll root.
- [x] Report touched or possibly touched files when an edge write fails partway
      through.

## Milestone 10: CLI Validate

- [x] Add `commander` to `@gridgen/cli` when CLI command implementation begins.
- [x] Implement `gridgen validate <source-file-or-dir>`.
- [x] Validate a single collection JSON file when the source is a file.
- [x] Validate every collection in `collections/` when the source is a source
      workspace directory.
- [x] Validate source asset references without writing output.
- [x] Print actionable validation errors with collection/item/field context.
- [x] Return a non-zero exit code for invalid collections or unsafe paths.
- [x] Keep validation behavior wired through `core` and `io`, not duplicated in
      command modules.

## Milestone 11: CLI Build Without Image Processing

- [x] Implement `gridgen build <source-file-or-dir> <jekyll-site>` for
      collections that already reference existing generated image names or
      placeholder planned assets.
- [x] Build one collection when the source is a collection file.
- [x] Build all collections under `collections/` when the source is a source
      workspace directory.
- [x] Write `_includes/gridgen/<collection-id>.html`.
- [x] Write `assets/gridgen/gridgen.css`.
- [x] Refuse unsafe output paths before writing any output.
- [x] Overwrite only inside `_includes/gridgen/` and `assets/gridgen/`.
- [x] Print a concise summary of generated include and CSS files.
- [x] Keep build command orchestration thin; render and path decisions come from
      `core`.

## Milestone 12: Image Asset Processing

- [x] Add `sharp` to `@gridgen/io` when image processing implementation begins.
- [x] Add the 20 MB upload limit as an exported constant.
- [x] Read source image metadata through the IO image boundary.
- [x] Convert percentage crop metadata to pixel crop regions safely.
- [x] Generate 512 by 512 WebP thumbnails.
- [x] Use cover/crop behavior by default.
- [x] Reject unsupported raster inputs with structured errors.
- [x] Reject invalid crop metadata with structured errors.
- [x] Reject oversized uploads before image processing.
- [x] Write generated WebP files under `assets/gridgen/<collection-id>/`.
- [x] Keep browser canvas output out of the persisted source-of-truth pipeline.

## Milestone 13: CLI Build With Image Processing

- [x] Integrate image processing into `gridgen build`.
- [x] Validate source images before writing generated output.
- [x] Generate missing or stale WebP assets from source images and crop metadata.
- [x] Remove stale generated files only inside the collection's
      `assets/gridgen/<collection-id>/` output directory.
- [x] Keep generated output stable across repeated builds with unchanged input.
- [x] Report generated image files in the build summary.
- [x] Ensure one failed image does not produce a misleading successful build.

## Milestone 14: Local Server Foundation

- [x] Add `hono` to `@gridgen/server` when server implementation begins.
- [x] Implement server startup for `gridgen run` with loopback-only binding.
- [x] Generate a per-run session token for mutating API requests.
- [x] Validate `Origin` for mutating requests when the header is present.
- [x] Avoid broad CORS.
- [x] Enforce JSON body size limits.
- [x] Enforce multipart body size limits.
- [x] Return structured JSON error responses derived from `GridgenError`.
- [x] Avoid exposing unreviewed absolute filesystem paths in browser responses.
- [x] Serve a health or bootstrap endpoint that lets the UI know the active
      source workspace and session context.

## Milestone 15: Local Server Collection API

- [x] Implement `GET /api/collections`.
- [x] Implement `POST /api/collections`.
- [x] Implement `GET /api/collections/:collectionId`.
- [x] Implement `PUT /api/collections/:collectionId`.
- [x] Implement `DELETE /api/collections/:collectionId` using soft delete.
- [x] Implement `POST /api/collections/:collectionId/validate`.
- [x] Ensure API request and response DTOs are browser-safe exports from
      `@gridgen/core`.
- [x] Ensure save routes persist draft collections and return the saved snapshot.
- [x] Ensure validation routes report draft/renderable errors without writing
      build output.
- [x] Ensure collection API routes do not duplicate domain validation already
      owned by `core`.

## Milestone 16: Local Server Asset API

- [x] Implement `POST /api/collections/:collectionId/assets`.
- [x] Store uploaded source images under
      `assets/<collection-id>/sources/`.
- [x] Return a normalized image reference with default crop metadata.
- [x] Reject unsupported file types before storing when possible.
- [x] Reject oversized uploads before image processing.
- [x] Normalize unsafe source file names.
- [x] Ensure uploaded asset references remain relative and portable.
- [x] Ensure upload failures do not leave misleading item state in the saved
      collection.

## Milestone 17: Preview Route

- [x] Implement `GET /preview/:collectionId`.
- [x] Validate the selected collection as renderable before previewing.
- [x] Generate preview HTML through the same core renderer used by
      `gridgen build`.
- [x] Ensure preview uses generated or preview-processed local image assets.
- [x] Show structured validation failures when a collection is not renderable.
- [x] Ensure preview is a full route that can be resized naturally in the
      browser.
- [x] Prevent React authoring components from approximating static output.

## Milestone 18: CLI Run

- [x] Implement `gridgen run [--source <dir>] [--port <port>] [--open]`.
- [x] Default the source workspace to `./gridgen`.
- [x] Create the source workspace structure when needed.
- [x] Start the local authoring server.
- [x] Print the local authoring URL by default.
- [x] Open the browser only when `--open` is passed.
- [x] Surface startup failures with clear CLI messages.
- [x] Ensure `run` uses server package startup behavior instead of duplicating
      HTTP setup in the CLI.

## Milestone 19: Web UI Foundation And shadcn

- [x] Install shadcn/ui and only the primitives needed for the active UI
      milestone.
- [x] Establish the app shell with a top bar and main editor area.
- [x] Replace Vite starter UI with Gridgen-specific UI.
- [x] Add a client API layer that talks to server routes using browser-safe DTOs
      from `@gridgen/core`.
- [x] Add empty state for first local run with a clear create-collection action.
- [x] Add saved/dirty status state.
- [x] Use shadcn primitives for generic controls instead of handcrafted
      equivalents.
- [x] Keep the UI free of direct filesystem, server-package, IO-package, and
      renderer imports.

## Milestone 20: Web Collection Editor

- [x] Implement collection title editing in the top bar.
- [x] Implement inline section title editing.
- [x] Render sections as the main editor structure.
- [x] Render item tiles in a responsive CSS Grid.
- [x] Add an add-section button.
- [x] Add an add-item placeholder tile inside each section.
- [x] Open an item editor in a right-side shadcn `Sheet`.
- [x] Support item title, description, link, alt text, and remove action in the
      item editor.
- [x] Show field-level validation feedback from server/core validation errors.
- [x] Keep draft state separate from persisted collection types where UI
      convenience requires it.

## Milestone 21: Web Save And Preview

- [x] Implement explicit Save action.
- [x] Treat the saved server response as the post-save source of truth.
- [x] Show non-noisy unsaved-change state.
- [x] Implement Preview action.
- [x] Surface renderable validation errors before or during preview.
- [x] Open preview as a full preview route.
- [x] Ensure preview uses the server/core renderer path, not React rendering.
- [x] Keep version 1 UI focused on save and preview, without direct Jekyll build
      controls.

## Milestone 22: Web Image Upload

- [x] Add image upload control to the item editor.
- [x] Send image uploads to the server asset API.
- [x] Display returned image previews in item tiles and the item editor.
- [x] Store returned image references in draft item state.
- [x] Show upload errors for oversized, unsupported, or unsafe files.
- [x] Preserve source image references so future crop edits do not require a new
      upload.

## Milestone 23: Web Crop Editor

- [x] Add `react-easy-crop` to `@gridgen/web` when crop UI implementation
      begins.
- [x] Add shadcn `Dialog` or `Sheet` for the crop editor surface.
- [x] Add shadcn `Slider` for zoom.
- [x] Use a square crop frame with `aspect={1}`.
- [x] Persist crop intent as percentage metadata.
- [x] Update tile/editor preview after crop confirmation.
- [x] Do not expose rotation controls in version 1.
- [x] Keep final persisted/generated image output server-driven through
      `@gridgen/io`.

## Milestone 24: Reordering

- [x] Add `dnd-kit` to `@gridgen/web` when reorder implementation begins.
- [x] Implement item reordering within a section.
- [x] Implement moving items between sections.
- [x] Implement section reordering.
- [x] Preserve stable IDs during all reorder operations.
- [x] Route reorder state changes through core collection operations.
- [x] Provide non-drag reorder controls where practical for accessibility and
      testability.
- [x] Ensure reorder behavior updates saved JSON order deterministically.

## Milestone 25: Example Fixtures And Developer Onboarding

- [x] Add an example source workspace under `examples/sample-grid/`.
- [x] Include at least one sample collection with multiple sections and items.
- [x] Include small sample source images suitable for local builds.
- [x] Add an example Jekyll target structure under `examples/jekyll-site/`.
- [x] Document the shortest local workflow in the README:
      `gridgen run`, save, `gridgen build`, and Jekyll include usage.
- [x] Document the source workspace structure and generated output structure.
- [x] Document the dependency policy so contributors know to add dependencies
      only in the milestone that uses them.

## Milestone 26: End-To-End Authoring Flow

- [x] Add Playwright when the local server and editor are ready for E2E coverage.
- [x] Cover first local run and create-collection journey.
- [x] Cover create, edit, upload, save, and preview journey.
- [x] Cover crop adjustment journey without rotation.
- [x] Cover CLI build output from an authored source workspace.
- [x] Ensure E2E coverage asserts user-visible behavior and generated output,
      not implementation details.
