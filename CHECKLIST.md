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
- [x] Reject renderable collections with empty collection titles, empty section
      names, or invalid provided item links.
- [x] Preserve optional item title, description, link, and image fields by
      omitting absent renderable output instead of forcing placeholder data.
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

## Milestone 27: UI shadcn Foundation Refresh

- [x] Initialize or repair shadcn/ui configuration in `apps/web` so
      `bunx --bun shadcn@latest info --json -c apps/web` reports real config,
      aliases, component paths, icon library, and global CSS location.
- [x] Install or repair any Tailwind/global CSS prerequisites required by the
      shadcn Vite setup without overwriting project-specific configuration
      blindly.
- [x] Preview shadcn-generated changes where possible and reconcile generated
      config with the existing Bun/Vite workspace setup.
- [x] Add the shadcn components needed by the UI redesign only when they are
      used: `sidebar`, `button`, `input`, `textarea`, `label`, `field`,
      `input-group`, `button-group`, `badge`, `separator`, `sheet`, `drawer`,
      `dialog`, `alert-dialog`, `alert`, `empty`, `skeleton`, `scroll-area`,
      `dropdown-menu`, `context-menu`, `tooltip`, `collapsible`, `resizable`,
      `slider`, and `sonner`.
- [x] Review every generated shadcn file after adding it and keep
      `components/ui/*` free of Gridgen product behavior.
- [x] Establish the shadcn semantic theme tokens used by the redesign,
      including sidebar, canvas, inspector, border, ring, muted, destructive,
      and primary action surfaces.
- [x] Replace any remaining hand-rolled shadcn-like primitives with
      CLI-managed shadcn primitives.
- [x] Keep all styling aligned with the repo-local shadcn rules: semantic
      colors, built-in variants first, `gap-*`, `size-*`, `truncate`, `cn()`,
      and no manual overlay z-index.

## Milestone 28: Workbench Shell And Top Bar

- [x] Rebuild the app shell around `SidebarProvider`, `CollectionSidebar`,
      `SidebarInset`, `TopBar`, `GridCanvas`, and `ItemEditorPanel`.
- [x] Use a fixed `56px` top bar with stable height across saved, dirty,
      saving, and error states.
- [x] Add `SidebarTrigger` as the first top-bar control or immediately before
      the brand group.
- [x] Show `Gridgen` and the active collection title with an accessible edit
      affordance.
- [x] Keep collection title edits routed through the existing draft/core
      operation path and preserve stable collection IDs.
- [x] Keep `New Collection`, `Preview`, and `Save` visible on desktop.
- [x] Collapse lower-priority top-bar actions into shadcn `DropdownMenu` on
      narrow widths.
- [x] Show saved/dirty/saving state without changing top-bar height or causing
      large layout shifts.
- [x] Keep sidebar collapsed state, inspector width, and section collapsed state
      as UI-only preferences unless a future design explicitly adds them to the
      persisted collection schema.
- [x] Keep the shell free of direct filesystem, server-package, IO-package, and
      renderer imports.

## Milestone 29: Collapsible Collection Sidebar

- [x] Implement `CollectionSidebar` with shadcn `Sidebar` using
      `collapsible="icon"`.
- [x] Configure `--sidebar-width` to `18rem` and `--sidebar-width-mobile` to
      `20rem` through the sidebar provider or generated shadcn sidebar
      variables.
- [x] Use `SidebarHeader` for the collection switcher or workspace context.
- [x] Use `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`,
      `SidebarGroupAction`, `SidebarMenu`, `SidebarMenuItem`,
      `SidebarMenuButton`, `SidebarMenuAction`, and `SidebarMenuBadge` for the
      collection list.
- [x] Use `SidebarMenuButton isActive` for the active collection.
- [x] Add `SidebarRail` for direct desktop collapse and expand behavior.
- [x] Preserve accessible names and tooltips for collapsed icon-rail controls.
- [x] Use `SidebarMenuSkeleton` for collection-list loading states.
- [x] Use shadcn mobile/off-canvas sidebar behavior on tablet and phone widths.
- [x] Ensure long collection names truncate without changing sidebar width.

## Milestone 30: Grid Canvas, Sections, And Item Cards

- [x] Center the editable grid canvas in the workbench with `minmax(0, 1fr)`,
      independent scrolling, and responsive padding using the UI design
      constraints.
- [x] Render sections with stable headers containing inline title editing, item
      count badges, reorder handles, collapse controls, and overflow actions.
- [x] Add shadcn `Collapsible` support for section bodies while keeping section
      headers, counts, validation state, and reorder controls visible.
- [x] Render item cards in responsive CSS Grid with a `168px` desktop target,
      `144px` narrow minimum, square image area, stable body height, and no
      hover-driven layout shifts.
- [x] Render add-item tiles with the same footprint as item cards.
- [x] Show selected item state through border or ring treatment, not color
      alone.
- [x] Use neutral missing-image placeholders instead of broken image UI.
- [x] Clamp item descriptions to two lines while preserving card height.
- [x] Add section and item `DropdownMenu` controls for secondary actions such
      as duplicate, move, remove, and open link.
- [x] Add mirrored `ContextMenu` behavior only for actions that are also
      reachable through visible controls.
- [x] Disable or omit invalid menu actions based on public draft state, such as
      moving the first item left or opening an empty link.
- [x] Keep all grid mutations routed through public core/browser collection
      operations.

## Milestone 31: Item Editor Panel And Image Tooling

- [x] Rebuild the selected-item editor as a persistent desktop inspector with
      default width `384px`.
- [x] Use shadcn `ResizablePanelGroup` for the desktop canvas/editor split with
      editor bounds from `320px` to `480px`.
- [x] Prevent editor resizing from shrinking the canvas below a usable item-grid
      width.
- [x] Keep the editor body internally scrollable and keep primary footer actions
      reachable.
- [x] Show an `Empty` inspector state when no item is selected.
- [x] Refactor editor fields to shadcn `FieldGroup`, `Field`, `FieldLabel`,
      `FieldDescription`, `Input`, and `Textarea`.
- [x] Refactor the link field to shadcn `InputGroup` with a link icon, not
      custom absolute positioning.
- [x] Add an image preview area that follows the same square visual rule as
      item cards.
- [x] Add a shadcn `ButtonGroup` for image actions: upload, crop, replace, and
      remove.
- [x] Keep image upload routed through the server asset API.
- [x] Keep crop intent emitted from `react-easy-crop` as percentage metadata.
- [x] Keep final generated image output server-driven through `@gridgen/io`.
- [x] Use `AlertDialog` for destructive remove actions that should require
      confirmation.
- [x] Map server/core field errors to the nearest visible editor field.

## Milestone 32: Responsive Editor Overlays

- [x] Use the desktop persistent inspector only when the canvas remains usable.
- [x] Use shadcn `Sheet` for tablet-sized item editing.
- [x] Use shadcn `Drawer` for phone-sized item editing and crop controls.
- [x] Ensure the sidebar uses shadcn mobile/off-canvas behavior below the
      desktop workbench breakpoint.
- [x] Keep the grid one column at phone width and avoid horizontal page scroll.
- [x] Keep top-bar actions reachable on phone widths through visible controls
      or `DropdownMenu`.
- [x] Verify the layout acceptance matrix from `UI DESIGN.md` in implementation
      at `1440px`, `1280px`, `1024px`, `768px`, and `390px` widths.
- [x] Ensure dialogs, sheets, and drawers all have accessible titles and
      intentional focus return behavior.

## Milestone 33: UI Feedback, Empty, Loading, And Undo States

- [x] Replace custom empty states with shadcn `Empty`.
- [x] Replace custom loading placeholders with shadcn `Skeleton` sized to match
      final sidebar, canvas, and editor layouts.
- [x] Replace screen-level and panel-level failures with shadcn `Alert`.
- [x] Keep validation errors inline with fields through `FieldDescription` and
      `aria-invalid`.
- [x] Add a global shadcn `sonner` toaster.
- [x] Use `sonner` for transient success feedback such as saved, image
      uploaded, and copied text.
- [x] Add undoable `sonner` actions for draft-only item or section removals
      where rollback can be represented safely in draft state.
- [x] Implement undo through public draft operations or a typed draft-state
      rollback path, not through private component mutation or test-only
      exports.
- [x] Ensure toasts are never the only place validation errors or destructive
      consequences are communicated.
- [x] Ensure disabled controls reflect real unavailable operations such as crop
      without image, save while saving, and move-up for the first section.

## Milestone 34: UI Visual And Behavior Coverage

- [x] Add E2E coverage for collapsing and expanding the desktop sidebar.
- [x] Add E2E coverage for opening the mobile/off-canvas sidebar behavior.
- [x] Add E2E coverage for resizing the desktop item editor within allowed
      bounds.
- [x] Add E2E coverage for section collapse and expansion.
- [x] Add E2E coverage for section and item overflow menu actions.
- [x] Add E2E coverage for image action `ButtonGroup` controls.
- [x] Add E2E coverage for tablet `Sheet` and phone `Drawer` editor behavior.
- [x] Preserve existing first-run, create, edit, upload, crop, save, preview,
      and CLI-build authoring coverage.
- [x] Add focused public-interface tests for nontrivial browser-safe UI helpers,
      such as field-error mapping, draft undo rollback, responsive editor-mode
      selection, and menu-action availability.
- [x] Add keyboard/focus behavior coverage for sidebar trigger, overflow menus,
      item editor overlays, and destructive confirmations.
- [x] Capture or document visual verification for desktop, collapsed-sidebar,
      resized-inspector, tablet, and phone layouts.
- [x] Ensure UI coverage asserts user-visible behavior and public interfaces,
      not implementation details or test-only exports.

## Milestone 35: Poster Layout Preview And Build Output

- [x] Define a named opinionated static renderer layout for `/mu/core`-style
      recommendation grids.
- [x] Keep the generated Jekyll include embeddable with a transparent
      background.
- [x] Ensure preview wraps the same generated include and stylesheet in a
      preview-only black presentation shell.
- [x] Add a CLI build option for selecting the poster layout without changing
      source collection JSON shape.
- [x] Keep layout selection in pure core render/build planning types rather
      than branching directly inside CLI or server route code.
- [x] Render a large centered uppercase collection title for the poster layout.
- [x] Render item images as square tiles with stable object-fit behavior.
- [x] Render item title and optional description as centered captions below the
      image.
- [x] Ensure optional item fields remain valid in the poster layout: missing
      image, title, description, or link must not break rendering.
- [x] Use responsive CSS Grid so the poster layout adapts across desktop,
      tablet, and phone widths without fixed-row assumptions.
- [x] Keep section order and item order deterministic in the poster layout.
- [x] Render section names as visible poster tier labels while preserving
      section order as row/group boundaries.
- [x] Ensure generated HTML remains static: no JavaScript, inline handlers,
      remote scripts, or remote image assets.
- [x] Add public-interface renderer tests covering transparent generated output,
      black preview shell behavior, captions, links, optional fields, and
      escaping.
- [x] Add CLI tests covering the poster layout option and generated file
      contents.
- [x] Add server/preview tests proving preview uses the same poster renderer
      output with only the preview shell adding the black background.
- [x] Add or update E2E coverage for opening poster preview from the authoring
      UI and building matching Jekyll assets from the CLI.
- [x] Document the layout option and include usage in the README once the
      implementation is complete.

## Milestone 36: Astro React Build Target Contract

- [x] Define a finite build target type with `jekyll` and `astro-react`
      variants.
- [x] Make `astro-react` the default build target.
- [x] Require explicit `--target jekyll` for Jekyll output.
- [x] Add CLI parsing for `gridgen build --target jekyll|astro-react` with
      structured errors for unknown targets.
- [x] Make `poster` the default build layout.
- [x] Keep `classic` available through explicit `--layout classic`.
- [x] Keep layout selection as a build/render option and do not persist layout
      choice into authoring collection JSON.
- [x] Rename CLI destination concepts from Jekyll-specific language to
      target-root language where the code is target-agnostic.
- [x] Keep source resolution shared: a single collection file builds one
      collection, and a source workspace builds every JSON file under
      `collections/`.
- [x] Keep target dispatch at the CLI/package boundary; target-specific path
      and render decisions must live in core build planning.
- [x] Preserve the current Jekyll output paths, logs, cleanup behavior, and
      generated include contents for `--target jekyll`.
- [x] Update compatibility tests so old implicit Jekyll/classic assumptions are
      replaced with explicit `--target jekyll` and `--layout classic` cases.

## Milestone 37: Astro React Core Build Planning

- [x] Add `AstroReactBuildInput` and `AstroReactBuildPlan` public core types
      with useful JSDoc.
- [x] Plan generated Astro component output at
      `src/gridgen/GridgenRecommendationGrid.tsx`.
- [x] Plan generated Astro stylesheet output at `src/gridgen/gridgen.css`.
- [x] Plan one render-ready JSON output per collection at
      `src/gridgen/<collection-id>.json`.
- [x] Keep shared Astro component and stylesheet outputs separate from
      per-collection JSON and image outputs in the build plan.
- [x] Plan processed image outputs under
      `public/gridgen/assets/<collection-id>/`.
- [x] Ensure every planned Astro output path is inside the selected Astro
      project root.
- [x] Reuse existing image crop, resize, format, and deterministic item-image
      naming rules.
- [x] Rewrite generated JSON image references to root-relative public URLs such
      as `/gridgen/assets/music/album-a.webp`.
- [x] Ensure Astro render-ready JSON records `poster` as the default layout
      unless the user explicitly selects another layout.
- [x] Ensure render-ready JSON does not contain source crop metadata, local
      filesystem paths, or source image file names.
- [x] Add public-interface core tests covering Astro path planning, image URL
      rewriting, layout preservation, optional item fields, and path-safety
      failures.

## Milestone 38: Astro React Component And Render Data Generation

- [x] Define the generated render-data JSON schema/version for Astro React
      output.
- [x] Keep the render-data schema separate from the authoring schema so source
      crop metadata and generated image URLs cannot be confused.
- [x] Add a pure core serializer for render-ready collection JSON.
- [x] Add a pure core generator for `GridgenRecommendationGrid.tsx`.
- [x] Make the generated component accept `collection` as a prop instead of
      importing generated JSON internally.
- [x] Keep CSS import explicit for the Astro user; the generated component must
      not import `gridgen.css` internally.
- [x] Render collection, section, item, link, image, title, and description
      semantics consistently with the static renderer.
- [x] Support all current renderer layouts, including `classic` and `poster`,
      from the render-ready JSON.
- [x] Keep the component Tailwind-independent and shadcn-independent by using
      namespaced `gridgen-*` classes.
- [x] Ensure React output performs no schema repair, filesystem work, image
      processing, network calls, or authoring-server calls.
- [x] Add behavior tests for generated component source contents and
      render-data serialization through public core APIs.

## Milestone 39: Astro React IO And Safe Writes

- [x] Generalize generated text-output writing so both Jekyll and Astro plans
      can use atomic text writes.
- [x] Generalize image processing execution so Astro image outputs reuse the
      existing Sharp-backed pipeline.
- [x] Add cleanup for stale files inside
      `public/gridgen/assets/<collection-id>/` without touching unrelated
      collections.
- [x] Prevent cleanup or writes outside the selected Astro project root.
- [x] Write the reusable Astro component and stylesheet once per build, even
      when building multiple collections.
- [x] Write one render-ready JSON file for each discovered collection.
- [x] Report possibly touched paths for partial write failures using the
      existing structured IO failure pattern.
- [x] Add IO-level tests for Astro text writes, image writes, cleanup scoping,
      and outside-root rejection.

## Milestone 40: Astro React CLI Build Integration

- [x] Implement default `gridgen build <source-file-or-dir> <astro-site>` as an
      Astro React poster build.
- [x] Implement explicit
      `gridgen build --target astro-react <source-file-or-dir> <astro-site>`.
- [x] Support single collection file input for Astro React builds.
- [x] Support source workspace input for Astro React builds, building every
      collection under `collections/` with one command.
- [x] Validate all selected collections and source assets before writing Astro
      output.
- [x] Print clear write logs for the component, stylesheet, collection JSON
      files, and processed image assets.
- [x] Preserve actionable structured errors for invalid collection JSON,
      missing source assets, unsafe paths, and unknown build targets.
- [x] Add CLI tests covering single-file Astro builds, workspace Astro builds,
      generated output contents, image URL rewriting, and failure behavior.
- [x] Ensure Jekyll CLI tests cover explicit `--target jekyll` usage.
- [x] Ensure layout CLI tests cover default poster behavior and explicit
      `--layout classic` behavior.

## Milestone 41: Astro React Documentation And Example

- [x] Document the Astro React workflow in the README, including the one-command
      default build from a source workspace.
- [x] Document that Astro React and poster layout are the defaults.
- [x] Document explicit Jekyll output with `--target jekyll`.
- [x] Document explicit classic layout output with `--layout classic`.
- [x] Document the three-import usage pattern for Astro pages.
- [x] Document optional Astro hydration at the callsite with examples such as
      `client:visible`.
- [x] Document that Gridgen does not require Tailwind and that generated CSS is
      ordinary namespaced CSS.
- [x] Document that the target Astro project must already be configured for
      React, such as through `@astrojs/react`.
- [x] Add or update an example Astro target fixture showing `src/gridgen/` and
      `public/gridgen/` output shape.
- [x] Include guidance for users who want to replace generated CSS or swap
      collection JSON while reusing the same component.

## Milestone 42: Bun And Bunx Packaging

- [x] Define the publishable package shape for Gridgen with a `gridgen` binary.
- [x] Decide whether the publishable package is the repository root package or
      a dedicated package workspace.
- [x] Ensure the published package is not marked `private`.
- [x] Add package metadata needed for installable CLI use: `name`, `version`,
      `type`, `bin`, `files`, `license`, and useful package description.
- [ ] Add repository metadata once the stable public repository URL is known.
- [x] Build the CLI into a published artifact instead of exposing raw workspace
      TypeScript files.
- [x] Use a Bun-compatible executable shebang for the generated CLI entrypoint.
- [x] Bundle or otherwise resolve internal workspace packages so published
      installs do not depend on `workspace:*` specifiers.
- [x] Include the built Vite authoring UI assets in the package so
      `gridgen run` works after install.
- [x] Keep runtime/native dependencies such as `sharp` declared correctly for
      user installs.
- [x] Add a package verification script that packs the install artifact and
      tests the packed package, not only the monorepo source tree.
- [x] Add release/build scripts that build the web UI, bundle the CLI, copy
      packaged assets, and produce the installable artifact in one predictable
      flow.
- [x] Verify packed-package behavior for `gridgen --help`, `gridgen run`,
      default Astro poster build, and explicit `--target jekyll` build.
- [x] Document Git/GitHub installation for alpha usage, including pinned tag or
      commit examples.
- [x] Document local project installation with Bun from a pinned GitHub tag or
      commit.
- [x] Document registry/bunx usage as the eventual stable path, such as
      `bunx gridgen run` and `bunx gridgen build ./gridgen ./my-astro-site`.
- [x] Document installation prerequisites, including Bun and target Astro React
      requirements.
- [x] Add README instructions for first-time setup, authoring with
      `gridgen run`, building default Astro output, and building explicit
      Jekyll output.
