# UI Design

This document is the UI-specific design guide for Gridgen. It complements
`DESIGN.md`, which defines the system architecture, domain boundaries, and
build/preview pipeline. This file defines how the authoring interface should
look, behave, and be implemented.

The UI should feel like a polished local workbench for building recommendation
grids: quiet, precise, fast, durable, and content-first. It should not feel like
a marketing page, a generic CRUD admin panel, or a pile of handcrafted widgets.

The current visual reference is:

- `UI Design/stitch_gridgen_recommendation_grid_generator/screen.png`
- `UI Design/stitch_gridgen_recommendation_grid_generator/DESIGN.md`
- `UI Design/stitch_gridgen_recommendation_grid_generator/code.html`

The Stitch prototype is an approximation, not a literal source file. Treat it
as a strong visual direction and interaction model, then implement it with real
project components, real state, real accessibility, and real data.

## Product UI Goal

Gridgen's authoring UI should let users create and maintain static
recommendation grids with minimal friction.

The primary mental model is:

```text
Collection
  -> Sections
    -> Recommendation items
      -> image, title, description, link, crop metadata
```

The UI should look like the artifact the user is making. The center of the app
is a grid canvas with sections and item cards. Editing controls sit around that
canvas without obscuring the user's sense of the final output.

## Functional Requirements Alignment

The UI exists to support the two workflows defined in `DESIGN.md`.

### `gridgen run`

The local authoring UI must support:

- first-run empty state when no source workspace exists or no collections are
  available
- collection creation through the local server
- collection title editing
- section title editing
- adding sections
- adding, selecting, editing, and removing recommendation items
- image upload through the server asset API
- square crop intent through `react-easy-crop`
- explicit save
- server-rendered preview
- clear saved/dirty/saving/error status
- collapsible collection sidebar with desktop icon rail and mobile off-canvas
  behavior
- direct section/item action menus for secondary operations
- compact image editing controls

The browser UI is allowed to hold draft state that is not yet renderable, but
it must not persist invalid raw shapes directly. Draft mutations should route
through browser-safe core operations or server responses.

### `gridgen build`

The browser UI does not own the Jekyll build workflow in version 1. The UI
should help the user create valid saved source files; the CLI build command
then produces Liquid includes, namespaced CSS, and optimized images.

Do not add a browser build/export button unless a future design explicitly
launches `gridgen run` with a Jekyll destination and defines that security
boundary. Build verification can still be covered by E2E tests that run the CLI
after using the UI to create saved source data.

### Functional Boundaries

The UI must preserve the architecture from `DESIGN.md`:

- Preview uses the server preview route and the core renderer.
- Build output uses the CLI/IO/core path, not React rendering.
- Image processing uses the server/IO pipeline, not browser canvas output as
  persisted truth.
- Server responses become the source of truth after save, upload, and
  collection creation.
- Domain validation errors come from core/server and are mapped to visible
  fields.
- Filesystem paths, source asset writes, and Jekyll output writes stay outside
  React.

## Non-Negotiable UI Principles

### Use Real shadcn/ui

The UI must use shadcn/ui primitives installed and managed through the shadcn
CLI. Do not continue growing hand-rolled lookalike primitives.

Current status at the time this document was written:

```text
bunx --bun shadcn@latest info --json -c apps/web
```

detects `apps/web` as a Vite TypeScript app, but reports:

```json
{
  "config": null,
  "components": []
}
```

That means shadcn is not properly initialized yet. The redesign should begin by
initializing shadcn in `apps/web`, then adding only the components needed for
the active UI milestone.

Use the repo-local shadcn skill as policy:

- `.agents/skills/shadcn/SKILL.md`
- `.agents/skills/shadcn/rules/composition.md`
- `.agents/skills/shadcn/rules/forms.md`
- `.agents/skills/shadcn/rules/icons.md`
- `.agents/skills/shadcn/rules/styling.md`
- `.agents/skills/shadcn/rules/base-vs-radix.md`

### Compose, Do Not Reinvent

Build Gridgen product components by composing shadcn primitives. Do not write a
custom styled `div` when a standard primitive exists.

Examples:

- Empty states use `Empty`.
- Field layout uses `FieldGroup`, `Field`, `FieldLabel`, and
  `FieldDescription`.
- Validation uses `data-invalid` on `Field` and `aria-invalid` on the control.
- App navigation uses `Sidebar`, `SidebarProvider`, `SidebarInset`,
  `SidebarTrigger`, and `SidebarRail`.
- Item counts and tags use `Badge`.
- Dividers use `Separator`.
- Loading placeholders use `Skeleton`.
- Modal tasks use `Dialog`.
- Side panels use `Sheet`.
- Phone bottom panels use `Drawer` when editing forms or crop controls.
- Destructive confirmations use `AlertDialog`.
- Menus use `DropdownMenu`.
- Grouped adjacent actions use `ButtonGroup`.
- Collapsible content uses `Collapsible`.
- Icon buttons use `Button size="icon"`.

Product-specific components should be thin, named compositions around those
primitives.

### Keep Domain Logic Out Of React Components

React components may orchestrate UI state, but collection operations must still
flow through public domain APIs from `@gridgen/core/browser`.

Do not duplicate domain validation in component code. The UI can render field
errors, disabled states, and previews, but the source of truth remains:

- core collection operations
- server API responses
- persisted draft collection JSON
- preview/build validation from the server/core path

If a UI behavior is hard to test without test-only exports, treat that as a
design warning. Prefer extracting public, meaningful browser-safe helpers over
testing private implementation details.

### Preview Is Not React Rendering

The authoring grid is an editor. The final rendered grid preview must continue
to come from the server preview route using the same renderer as
`gridgen build`.

The authoring UI may resemble the output, but it must not become a second
static-output renderer.

## Visual Direction

The prototype's most important visual ideas are correct:

- A fixed, compact top navigation bar.
- A fixed left collection sidebar.
- A scrollable central grid canvas.
- A right item editor panel on desktop.
- Recommendation cards with square images and compact metadata.
- Dashed add-item tiles.
- Simple monochrome controls with black primary actions.
- Subtle borders instead of heavy shadows.
- A calm neutral canvas that lets item artwork carry the visual weight.

The implementation should preserve those ideas while replacing mock-specific
details with production-grade components and data.

## Prototype Translation

The prototype should be translated into production UI as follows.

| Prototype Element                        | Production Interpretation                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Gridgen / Music [edit]` top-left header | `TopBar` brand, active collection title, and title edit affordance.                                                        |
| `New Collection` action                  | Collection creation dialog or direct create action backed by the server.                                                   |
| `Preview` action with eye icon           | Opens the server-rendered preview route after validation/save behavior.                                                    |
| Black `Save` button with orange dot      | Primary save action plus subtle dirty/saving/saved status indicator.                                                       |
| Left `Collections` control               | Collection navigation/switcher using live collection summaries.                                                            |
| Music/Movies/Games sidebar entries       | Real saved collections, not hardcoded categories. Use generic collection icons unless collection type becomes domain data. |
| Central S/A/B Tier sections              | Real collection sections with editable section titles, item count badges, and reorder handles.                             |
| Album cards                              | `RecommendationItemCard` with square image, title, short description, selected/hover state, and stable dimensions.         |
| Dashed `Add Item` tile                   | `AddItemTile`, present inside every section grid.                                                                          |
| Right `Item Editor` panel                | Persistent desktop inspector for selected item; responsive `Sheet` on smaller screens.                                     |
| Category tags                            | Out of scope until tags exist in the domain schema. Do not fake this in UI state.                                          |
| Mock Jekyll snippet                      | Optional future integration help, not part of the primary editor surface.                                                  |

The final UI should improve the prototype in these ways:

- Use real saved data instead of static sample content.
- Use real shadcn components and semantic tokens instead of CDN Tailwind and raw
  mock classes.
- Add a proper shadcn collapsible sidebar instead of a static sidebar mock.
- Add shadcn menus, button groups, collapsible sections, and feedback surfaces
  where they directly support the visual authoring flow.
- Use lucide icons instead of Material Symbols.
- Preserve accessibility, keyboard behavior, and typed state boundaries.
- Provide responsive behavior that the static mock does not define.

## shadcn-Driven UX Decisions

Use shadcn's application-level components confidently. The point of choosing
shadcn is to avoid rebuilding common professional app patterns by hand.

### Collapsible Sidebar Is Version 1

The collection sidebar should be implemented with shadcn `Sidebar`, not a
custom sidebar shell.

Required composition:

```text
SidebarProvider
├── CollectionSidebar
│   └── Sidebar collapsible="icon"
│       ├── SidebarHeader
│       ├── SidebarContent
│       │   └── SidebarGroup
│       │       └── SidebarMenu
│       │           └── SidebarMenuItem
│       │               ├── SidebarMenuButton
│       │               └── SidebarMenuBadge or SidebarMenuAction
│       ├── SidebarFooter
│       └── SidebarRail
└── SidebarInset
    └── AppWorkbench
```

Expected behavior:

- Desktop sidebar expands to the normal collection list.
- Desktop sidebar collapses to an icon rail with `collapsible="icon"`.
- `SidebarTrigger` appears in the top bar.
- `SidebarRail` is present for direct rail toggling.
- Active collection uses `SidebarMenuButton isActive`.
- Long collection names truncate in expanded mode.
- Collapsed mode keeps icon buttons accessible through labels or tooltips.
- Mobile behavior uses shadcn's sidebar mobile/off-canvas behavior rather than
  a separate custom menu.
- Sidebar width is configured through shadcn sidebar variables, not hard-coded
  app CSS scattered across components.

Target variables:

```tsx
<SidebarProvider
  style={
    {
      "--sidebar-width": "18rem",
      "--sidebar-width-mobile": "20rem"
    } as React.CSSProperties
  }
>
  ...
</SidebarProvider>
```

The implementation should follow the generated shadcn `Sidebar` file and docs
for the exact API. Do not build a parallel sidebar state system.

### Scoped shadcn Punch-Ups For Version 1

Use these components because they improve the direct visual authoring workflow
without changing the product scope:

- `ButtonGroup` for tightly related toolbar actions, such as image upload/crop
  controls or grouped section actions.
- `DropdownMenu` for section/item overflow actions.
- `ContextMenu` for right-click item and section actions if it mirrors visible
  menu actions.
- `Tooltip` for icon-only controls, especially collapsed sidebar buttons.
- `Collapsible` for section body collapse when a collection grows large.
- `Drawer` for phone-sized bottom editing flows.
- `Resizable` for bounded desktop canvas/inspector resizing; keep minimum and
  maximum sizes so the grid cannot be crushed.
- `sonner` for lightweight success and undo feedback.

Do not add decorative components just because they exist. Use shadcn components
when they make the UI more usable, more accessible, or more maintainable.
Do not add a command palette in version 1; this app should remain a simple
direct-manipulation GUI.

## Layout Architecture

The app should use a stable workbench shell.

```text
SidebarProvider
├── CollectionSidebar
└── SidebarInset
    ├── TopBar
    └── AppBody
        ├── GridCanvas
        └── ItemEditorPanel
```

### Shell Geometry

Use these as the canonical comfortable-desktop layout targets. They are design
constants, not permission to create brittle viewport assumptions. Fixed values
are appropriate for stable chrome and repeated elements; available workspace
width must remain fluid.

- Top bar height: `56px`.
- Left sidebar width: `288px`.
- Right editor panel default width: `384px`.
- Right editor panel bounded desktop resize range: `320px` to `480px`.
- Canvas background: `--canvas`, falling back to `--muted`.
- Canvas inner content width: `min(100%, 1000px)`.
- Canvas wide-desktop padding: `48px`.
- Canvas standard desktop padding: `32px`.
- Section vertical gap: `64px`.
- Section header bottom gap: `32px`.
- Card gap: `24px`.
- Workbench body height: `calc(100svh - 56px)`.

Sizing policy:

- Fixed: top bar height, desktop card target width, card image aspect ratio,
  card body reserved height, borders, radii, and standard gaps.
- Bounded responsive: sidebar width, editor width, canvas padding, and card
  tracks at narrower widths.
- Fluid: center canvas width, canvas scroll area, dialogs/sheets, and all
  text-bearing containers that may receive user content.
- Never fixed to viewport width: page width, canvas width, or any image's
  natural dimensions.
- Use `minmax(0, 1fr)` for the center workspace so it can shrink without
  forcing horizontal page scroll.
- Collapse side panels before the canvas becomes too narrow for useful editing.

Recommended desktop shell CSS shape:

```css
.gridgen-app-shell {
  min-height: 100svh;
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr);
}

.gridgen-workbench {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 384px;
}

@media (width < 1280px) {
  .gridgen-workbench {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
}

@media (width < 1024px) {
  .gridgen-workbench {
    grid-template-columns: minmax(0, 1fr);
  }
}

.gridgen-canvas {
  min-width: 0;
  overflow-y: auto;
}

.gridgen-canvas-inner {
  width: min(100%, 1000px);
  padding-inline: clamp(16px, 4vw, 48px);
}
```

The class names above are illustrative. The sidebar itself is outside this grid
when using shadcn `SidebarProvider` and `SidebarInset`; shadcn owns the
expanded/collapsed/off-canvas sidebar behavior.

On desktop, the canvas/editor split should use shadcn `ResizablePanelGroup`
with a default inspector size equivalent to `384px`. Keep the inspector bounded to
roughly `320px`-`480px`, and prevent the canvas panel from shrinking below a
usable card grid.

The shell must avoid layout jumps:

- The top bar height should not change with save status.
- The sidebar width should not change when collection names differ.
- The editor panel width should not change when selected items differ.
- Cards and add tiles should have matching footprints inside a section grid.
- Opening and closing dialogs/sheets must not resize the underlying canvas.

### Layout Layers

Use these layers consistently:

| Layer         | Surface Token                | Purpose                                      |
| ------------- | ---------------------------- | -------------------------------------------- |
| Page shell    | `--background`               | Browser page and top-level app background.   |
| Sidebar       | `--sidebar`                  | Collection navigation surface.               |
| Canvas        | `--canvas` or `--muted`      | Scrollable recommendation editing area.      |
| Cards/panels  | `--card`                     | Item cards, dialogs, editor panel internals. |
| Inspector     | `--inspector` or `--card`    | Right item editor panel.                     |
| Hover/active  | `--accent`                   | Low-emphasis interactive state.              |
| Selected item | `--ring` plus `--foreground` | Selected card outline/ring.                  |
| Destructive   | `--destructive`              | Remove item and destructive confirmations.   |

Do not introduce decorative gradients, orbs, large shadows, colored page bands,
or marketing-style hero composition.

### Top Bar

Purpose:

- Show product identity.
- Show the active collection title.
- Provide collection-level actions.
- Show save state.

Desktop layout:

```text
Gridgen | Music [edit]
                             New Collection   Preview   Save
```

Expected controls:

- `SidebarTrigger` for collapse/off-canvas sidebar control.
- Brand text: `Gridgen`.
- Active collection title with edit affordance.
- `New Collection` button.
- `Preview` button with eye icon.
- `Save` primary button with saved/dirty/saving indicator.

Implementation guidance:

- Use `Button` variants rather than custom button styling.
- Use `Separator` for vertical dividers.
- Use lucide icons with `data-icon="inline-start"` or
  `data-icon="inline-end"`.
- Keep top bar height stable, approximately `56px`.
- The top bar should not wrap on desktop. At small widths, collapse lower
  priority actions into a `DropdownMenu`.
- The dirty indicator should be subtle. Prefer a `Badge`, small status text, or
  a semantic dot rendered by a reusable `SaveStatusIndicator`, not ad hoc
  inline styling.
- The title edit affordance should be keyboard accessible. If using an icon
  button, it must have an accessible name.

Precise layout:

- Height: `56px`.
- Horizontal padding: `24px`.
- Brand group: left aligned, fixed height, no wrapping.
- Action group: right aligned, `gap: 8px`.
- Sidebar trigger: first control in the bar or immediately before the brand
  group.
- Vertical separators: shadcn `Separator orientation="vertical"` with visual
  height around `16px`.
- Save button: primary variant, minimum height `36px`.
- Preview/New Collection buttons: ghost or secondary variants, minimum height
  `36px`.
- Dirty indicator: appears inside or adjacent to Save without changing button
  width by more than the reserved status slot.

### Collection Sidebar

Purpose:

- Let users switch collections.
- Show the current source workspace context.
- Keep the editor oriented around a collection list.

Desktop layout:

```text
[ Collections v ]

[icon] Music
[icon] Movies
[icon] Games
```

The prototype hardcodes Music, Movies, and Games. Production must use actual
saved collection summaries from the local server.

Expected controls:

- Collection switcher/header.
- Collection list.
- Active collection state.
- Create collection action in the sidebar header or group action.
- Desktop collapse/expand trigger through `SidebarTrigger` and `SidebarRail`.

Implementation guidance:

- Use shadcn `Sidebar` for version 1.
- Use `SidebarProvider` at the shell root.
- Use `SidebarInset` around the main workbench.
- Use `Sidebar collapsible="icon"` for desktop icon-rail collapse.
- Use `SidebarHeader` for collection workspace/switcher affordance.
- Use `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`,
  `SidebarGroupAction`, `SidebarMenu`, `SidebarMenuItem`,
  `SidebarMenuButton`, `SidebarMenuAction`, and `SidebarMenuBadge` for the
  collection list.
- Use `SidebarMenuSkeleton` for sidebar loading state.
- Use `SidebarRail` for direct collapse/expand interaction.
- Do not store filesystem details in this component beyond browser-safe display
  text from `/api/bootstrap`.
- Avoid category-specific icons as a domain promise. A simple collection icon is
  enough unless collection type metadata is added later.
- Active collection selection should match the prototype's high-contrast
  treatment: visually obvious, but expressed through shadcn variants or
  semantic sidebar tokens.
- Long collection names must truncate without changing sidebar width.

Precise layout:

- Expanded desktop width: `18rem` through `--sidebar-width`.
- Mobile sidebar width: `20rem` through `--sidebar-width-mobile`.
- Collapsed desktop width: shadcn `collapsible="icon"` default, with icons and
  accessible names preserved.
- Background: sidebar token, not canvas token.
- Border: shadcn sidebar border token.
- Collection switcher height: match `SidebarMenuButton` sizing.
- Collection nav item height: use `SidebarMenuButton` sizing rather than a
  custom row height.
- Active item should use the strongest navigation treatment in the sidebar:
  `SidebarMenuButton isActive` plus sidebar tokens.

### Grid Canvas

Purpose:

- Display sections and item cards in the same conceptual shape as the final
  recommendation grid.
- Make adding, selecting, and reordering items natural.

Desktop layout:

```text
S Tier                         2 items  drag
[Album A card] [Album B card] [Add Item]

A Tier                         3 items  drag
[Item] [Item] [Item] [Add Item]

B Tier                         7 items  drag
[Item] [Item] [Item] [Item]
[Item] [Item] [Add Item]
```

Implementation guidance:

- The canvas scrolls independently inside the shell.
- Use generous but predictable spacing between sections.
- Use responsive CSS Grid for cards.
- Use stable dimensions for cards and add tiles.
- Use section headers with inline title editing.
- Show item count with `Badge`.
- Use a drag handle button for section reorder.
- Use `dnd-kit` for drag behavior and explicit non-drag controls where
  practical for accessibility and tests.

Grid sizing target:

- Desktop card target width: `168px`.
- Narrow card minimum width before one-column mobile layout: `144px`.
- Card image aspect ratio: `1 / 1`.
- Desktop card body height: `104px`.
- Desktop card total minimum height: `272px`.
- Add-item tile minimum height: same as item card height in the same viewport.
- Desktop card gap: `24px`.
- Card border radius: shadcn `rounded-lg` or `8px`, not pill-shaped.

Recommended grid CSS shape:

```css
.gridgen-item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(144px, 168px));
  gap: 24px;
  align-items: start;
}
```

At narrower widths, allow tracks to fill available space without dropping below
the useful minimum:

```css
grid-template-columns: repeat(auto-fill, minmax(144px, 1fr));
```

At mobile widths, prefer one full-width column over cramped two-column cards:

```css
@media (width < 640px) {
  .gridgen-item-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Do not use a layout where hover controls, labels, or validation text changes
the grid track size.

Section requirements:

- Section title editing should preserve the section's stable ID.
- Empty sections should still show an add-item tile.
- Item count should include real items only, not the add tile.
- Section drag/reorder handle should be visually secondary.
- Section bodies support shadcn `Collapsible` so users can hide a long section
  while preserving the section header, count, validation state, and reorder
  controls.
- Validation errors for section names should render near the title field.

Item card requirements:

- Card image area is always square.
- Missing-image state uses a neutral placeholder, not broken image UI.
- Long titles use one line with `truncate` by default. If a two-line treatment
  is later chosen, it must reserve fixed height and not resize cards.
- Descriptions are clamped to two lines with fixed preview height.
- Selected state must be visible through border/ring treatment and not depend
  solely on color.
- Hover actions must not shift card layout.
- Image object fit is always `cover`.
- Card content padding: `16px`.
- Image-to-body transition has no gap caused by image loading.

### Item Editor Panel

Purpose:

- Edit the selected recommendation item without making the grid disappear.

Desktop behavior:

- Persistent right panel.
- Default width `384px`.
- Bounded resize with shadcn `Resizable` on desktop viewports.
- Minimum width `320px`; maximum width `480px`.
- Scrolls internally when content exceeds viewport.
- Visible only when an item is selected, or present as an empty inspector state.

Small viewport behavior:

- Use shadcn `Sheet` from the right on tablet.
- Use shadcn `Drawer` from the bottom on phone-sized viewports.
- The grid remains the main screen.

Expected sections:

- Panel title: `Item Editor`.
- Image preview/upload/crop controls.
- Title field.
- Description field.
- Link field with link icon via `InputGroup`.
- Alt text field.
- Destructive remove action.
- Done/close action.

Implementation guidance:

- Use `FieldGroup` and `Field` for all form layout.
- Use `InputGroup` for the link icon rather than absolute positioning.
- Use `Alert` for validation summaries.
- Use `FieldDescription` for field-level validation messages.
- Use `Button variant="destructive"` for removal, ideally behind
  `AlertDialog` once destructive confirmations are added.
- Keep image actions as real buttons over or below the image preview.
- The panel must not directly save to disk. It updates draft UI state, and Save
  persists via the API.
- The panel footer should remain reachable. On desktop, prefer a sticky footer
  for done/remove actions when content scrolls.
- The image preview should use the same square visual rule as item cards.
- The crop action should be unavailable until an image exists and should explain
  that state through disabled button semantics or field text.
- If no item is selected, show a quiet empty inspector state rather than leaving
  ambiguous stale item fields visible.

Precise layout:

- Default width: `384px`.
- Resizable bounds: `320px` to `480px`.
- Background: inspector/card token.
- Border: left border using `--border`.
- Header height: `72px`.
- Header padding: `24px`.
- Body padding: `24px`.
- Body field gap: `16px`.
- Footer padding: `24px`.
- Footer gap: `12px`.
- Image preview: square, full panel width, max height equal to available width.
- Primary footer action: full width.
- Destructive footer action: full width outline/destructive treatment.

The editor panel should never overlap the canvas on desktop. On tablet and
mobile where overlap is necessary, use shadcn overlay components rather than
custom absolute positioning.

## Responsive Behavior

The UI must work naturally at all reasonable desktop and mobile widths.

### Wide Desktop

Target:

- Top bar fixed.
- Left sidebar fixed.
- Right item editor fixed.
- Center canvas scrolls.
- Four or more item cards may fit per row depending on width.

### Narrow Desktop / Tablet

Target:

- Top bar remains fixed.
- Left sidebar can reduce width or become collapsible.
- Right item editor becomes a `Sheet` if space is tight.
- Grid cards should remain readable and not shrink below useful dimensions.

### Mobile

Target:

- The app remains usable, not merely non-broken.
- Sidebar uses shadcn mobile/off-canvas behavior.
- Item editor uses `Drawer` on phone widths.
- Top actions collapse into a menu if needed.
- Grid is one or two columns depending on available width.

Never rely on viewport-scaled font sizes. Use stable type sizes and responsive
layout constraints.

Suggested responsive thresholds:

- `>= 1280px`: expanded shadcn sidebar, canvas, and bounded resizable
  inspector are all visible.
- `1024px` to `1279px`: sidebar may collapse to icon mode; inspector may dock
  only if the canvas remains at least `480px` wide.
- `< 1024px`: editor should become an overlay; sidebar should use shadcn mobile
  sidebar behavior.
- `< 640px`: one-column card grid, compact top bar actions, no persistent side
  panels.

These thresholds can be adjusted during implementation, but each state must be
explicitly verified.

Responsive acceptance criteria:

- At `1440px` wide, top bar, sidebar, canvas, and editor are all visible.
- At `1024px` wide, no text overlaps and card grid remains usable.
- At `768px` wide, item editor is not docked; it opens as a `Sheet`.
- At `390px` wide, the grid is one column, top actions are reachable, no
  horizontal page scroll is introduced, and the item editor opens as a
  `Drawer`.

### Layout Acceptance Matrix

Use this matrix when reviewing implementation screenshots. The exact component
tree can differ, but the visible behavior must match.

| Viewport Width | Sidebar                      | Editor                     | Canvas Padding | Card Grid                                                       |
| -------------- | ---------------------------- | -------------------------- | -------------- | --------------------------------------------------------------- |
| `1440px`       | Expanded, collapsible rail   | `384px` default, resizable | `48px`         | `168px` target card tracks with `24px` gaps where space allows. |
| `1280px`       | Expanded, collapsible rail   | `384px` default, resizable | `32px`         | `168px` target card tracks; no horizontal page scroll.          |
| `1024px`       | Collapsible sidebar behavior | `360px` or sheet           | `24px`-`32px`  | Cards remain at least `144px` wide.                             |
| `768px`        | Mobile/off-canvas sidebar    | Sheet                      | `24px`         | One or two columns depending on available width.                |
| `390px`        | Mobile/off-canvas sidebar    | Drawer                     | `16px`         | One column, no horizontal page scroll.                          |

## Design Tokens

The prototype uses a neutral, shadcn-like design system. Production should use
semantic tokens rather than raw colors in component code.

Preferred semantic mapping:

```text
--background
--foreground
--card
--card-foreground
--popover
--popover-foreground
--primary
--primary-foreground
--secondary
--secondary-foreground
--muted
--muted-foreground
--accent
--accent-foreground
--destructive
--destructive-foreground
--border
--input
--ring
--sidebar
--sidebar-foreground
--sidebar-accent
--sidebar-accent-foreground
--sidebar-border
```

Use black/near-black primary actions in light mode. Use neutral/zinc surfaces
and borders. Avoid colorful decoration. The item artwork should provide most of
the color.

Do not use raw Tailwind color utilities in app components when a semantic token
or component variant should exist.

### Token Ownership

The shadcn global CSS file is the source of truth for semantic UI tokens. Do
not create parallel theme files.

After shadcn initialization, use the `tailwindCssFile` reported by:

```sh
bunx --bun shadcn@latest info --json -c apps/web
```

as the only place for theme variables.

If custom Gridgen tokens are necessary, they should be semantic and narrow:

```text
--canvas
--canvas-foreground
--inspector
--inspector-foreground
--item-card-selected
```

Prefer standard shadcn tokens first. Add custom tokens only when standard
tokens cannot express a repeated product concept clearly.

### Target Light Theme Values

These values define the intended light-mode look. They should be expressed as
shadcn semantic variables in the global CSS file, not repeated as raw colors in
components.

| Token                  | Target                                                  |
| ---------------------- | ------------------------------------------------------- |
| `--background`         | near-white app background, equivalent to zinc-50/white. |
| `--foreground`         | near-black text, equivalent to zinc-950.                |
| `--card`               | white.                                                  |
| `--muted`              | very light neutral canvas, equivalent to zinc-50.       |
| `--muted-foreground`   | medium neutral text, equivalent to zinc-500/zinc-600.   |
| `--primary`            | near-black.                                             |
| `--primary-foreground` | white.                                                  |
| `--border`             | subtle neutral border, equivalent to zinc-200.          |
| `--input`              | subtle neutral input border, equivalent to zinc-200.    |
| `--ring`               | near-black or strong neutral focus ring.                |
| `--destructive`        | accessible red.                                         |
| `--sidebar`            | white or near-white, visually distinct from canvas.     |
| `--canvas`             | `#f9f9fb` or equivalent muted app canvas.               |
| `--inspector`          | white.                                                  |

If the shadcn preset uses OKLCH values, convert these targets into matching
OKLCH variables. The visual target matters more than the color notation.

### Visual Acceptance Details

These details define the expected feel of the prototype translation.

- Top bar: white or background surface, `1px` bottom border, no shadow.
- Sidebar: white or sidebar surface, `1px` right border, active item clearly
  selected with semantic sidebar tokens.
- Canvas: muted near-white surface, no card-like outer wrapper around the
  whole canvas.
- Editor panel: white/card surface, `1px` left border, no overlap with desktop
  canvas.
- Item cards: white card surface, `1px` border, `rounded-lg` or `8px` radius,
  at most `shadow-sm`.
- Selected item card: visible ring or stronger border, not color-only.
- Add-item tile: same footprint as item cards, dashed neutral border, centered
  plus action, muted label.
- Primary actions: near-black primary button with white foreground.
- Destructive actions: shadcn destructive treatment, not custom red text unless
  that is the component variant.
- Focus states: use shadcn ring tokens and must remain visible on cards,
  buttons, fields, and drag handles.

## Typography

The prototype uses Inter. That is a good default if we decide to include a font
dependency or local font asset, but the implementation should not fetch Google
Fonts from the browser at runtime.

Typography goals:

- Compact, precise, readable.
- Moderate heading hierarchy.
- Labels are clear and slightly stronger than helper text.
- No oversized hero typography.
- No negative tracking in normal body/control text.

Suggested scale:

- App brand and top bar text: `14px`, medium/semibold.
- Section titles: `28px`, semibold, `36px` line height.
- Card titles: `16px`, semibold, `24px` line height.
- Card descriptions: `14px`, regular, `20px` line height.
- Form labels: `14px`, medium/semibold, `20px` line height.
- Small badges/status text: `12px`, medium, `16px` line height.

Do not scale font size with viewport width. Change layout, not typography.

## Component Architecture

All UI code in `apps/web` should be organized by responsibility.

Target structure:

```text
apps/web/src/
  app/
    App.tsx
    AppShell.tsx
    app-state.ts

  components/
    ui/
      shadcn-managed components

  features/
    collections/
      CollectionSidebar.tsx
      CollectionSwitcher.tsx
      CreateCollectionDialog.tsx

    editor/
      GridCanvas.tsx
      RecommendationSection.tsx
      RecommendationItemCard.tsx
      AddItemTile.tsx
      SectionToolbar.tsx
      ItemEditorPanel.tsx
      ItemEditorDrawer.tsx
      EditorSplitPane.tsx
      ImageCropDialog.tsx

    preview/
      PreviewButton.tsx

  lib/
    api.ts
    draft-editing.ts
    field-errors.ts
    ids.ts
    utils.ts
```

This structure is aspirational. Add directories as the code grows; do not
create empty folders.

### Import Boundaries

UI component imports should remain disciplined:

- `components/ui/*`: shadcn-managed primitives and minimal local variant
  adjustments.
- `features/*`: product components composed from shadcn primitives.
- `lib/api.ts`: browser API client only.
- `lib/draft-editing.ts`: browser-safe public domain operation wrappers.
- React components may import `@gridgen/core/browser`, but must not import
  `@gridgen/core`, `@gridgen/server`, or `@gridgen/io`.
- React components must not read or write filesystem paths.
- Product components should receive data and callbacks through props unless a
  dedicated feature hook owns that state.

### State Orchestration

Use a small number of state owners. Avoid letting every component fetch or
mutate independently.

Recommended pattern:

```text
App
  -> useGridgenAppState or app reducer
    -> API client
    -> draft editing helpers
    -> product component props
```

The state owner should coordinate:

- initial bootstrap
- collection list loading
- active collection loading
- draft mutations
- selected item state
- save/dirty state
- preview validation/opening
- upload requests
- global request failures

Presentation components should stay mostly deterministic and prop-driven.

### Component Contracts

Every product component should have a clear contract:

- What data it receives.
- What events it emits.
- What it is forbidden to know.
- Which shadcn primitives it composes.

For example:

```text
RecommendationItemCard
  Receives: item preview data, selected boolean, disabled/reorder metadata.
  Emits: select, reorder intent, optional open link intent.
  Forbidden: server calls, parsing links, writing draft collection state.
  Composes: Button, Badge if needed, Tooltip for hover actions.
```

This keeps the UI maintainable as the editor grows.

### Product Components

#### `AppShell`

Owns the workbench layout:

- top bar
- sidebar
- main canvas
- editor panel slot

It should not know item editing details.

#### `TopBar`

Props should include:

- active collection title
- save state
- create collection handler
- preview handler
- save handler

It should not own collection mutation logic.

#### `CollectionSidebar`

Props should include:

- collection summaries
- active collection ID
- active workspace display path
- selection handler

It should not fetch data directly.

It should compose shadcn `Sidebar` primitives and expose collapse behavior
through shadcn's provider/trigger/rail APIs.

#### `GridCanvas`

Props should include:

- draft collection
- field errors
- selection state
- section/item mutation handlers

It should not call server APIs directly.

#### `RecommendationSection`

Owns section-level presentation:

- title field
- item count badge
- drag handle
- item grid
- add item tile

It should route mutations through callbacks that eventually call core/browser
operations.

#### `RecommendationItemCard`

Owns item tile presentation:

- image preview
- title
- description
- selected state
- hover tools
- drag handle if needed

It should never parse or validate links/images itself.

#### `ItemEditorPanel`

Owns selected-item editing controls.

It receives an item and callbacks. It must not directly persist the collection.
It should operate on draft state.

#### `EditorSplitPane`

Owns the desktop `ResizablePanelGroup` composition for canvas and item editor
sizing.

It receives already-rendered canvas/editor slots and layout constraints. It
must not own item editing state or domain operations.

#### `ImageCropDialog`

Owns crop interaction through `react-easy-crop`.

It stores and emits percentage crop metadata only. Final generated image output
must remain server-driven through `@gridgen/io`.

## shadcn Component Inventory

Initialize shadcn before redesign work:

```sh
bunx --bun shadcn@latest init -c apps/web
```

Exact flags/preset should be chosen deliberately before running the command. Do
not overwrite existing files without reviewing diffs.

Expected setup choices:

- Framework: Vite.
- TypeScript: yes.
- Base: Radix, unless the project explicitly chooses shadcn Base.
- Icon library: lucide.
- Components path: `apps/web/src/components/ui`.
- Utils path: `apps/web/src/lib/utils.ts`.
- Global CSS: `apps/web/src/index.css`, unless shadcn reports a better target.
- Aliases: define explicit aliases if shadcn initialization requires them; then
  use those aliases consistently.

After initialization:

- Run `bunx --bun shadcn@latest info --json -c apps/web`.
- Record the resulting component paths and alias assumptions in the
  implementation notes or PR description.
- Before adding a component, check whether it is already installed.
- For each added component, read the generated file and verify it follows the
  repo-local shadcn rules.
- Use `bunx --bun shadcn@latest docs <component>` before relying on component
  APIs that are not already familiar.

Expected components to add early:

```text
sidebar
button
input
textarea
label
field
input-group
button-group
badge
separator
sheet
drawer
dialog
alert-dialog
alert
empty
skeleton
scroll-area
dropdown-menu
context-menu
tooltip
collapsible
resizable
slider
sonner
```

Potentially useful later:

```text
popover
select
tabs
hover-card
toggle-group
command
kbd
```

Do not add all components up front. Add components when the implementation
actually uses them.

### shadcn Managed Files

Files under `components/ui` are source code owned by the project, but they
should remain close to upstream shadcn. Avoid mixing product behavior into UI
primitive files.

Allowed changes:

- Project-specific variants when they represent repeated design-system needs.
- Required import path fixes.
- Small compatibility changes needed for this Vite/Bun/TypeScript setup.

Not allowed:

- One-off Gridgen product logic inside shadcn primitive files.
- Raw product-specific colors in primitive files.
- Adding props that duplicate composition patterns.

## Form Design

All editor forms must use shadcn form primitives.

Correct pattern:

```tsx
<FieldGroup>
  <Field data-invalid={hasTitleError ? true : undefined}>
    <FieldLabel htmlFor="item-title">Title</FieldLabel>
    <Input id="item-title" aria-invalid={hasTitleError ? true : undefined} />
    {hasTitleError ? <FieldDescription>{titleError}</FieldDescription> : null}
  </Field>
</FieldGroup>
```

Link input should use `InputGroup`:

```tsx
<InputGroup>
  <InputGroupAddon>
    <LinkIcon />
  </InputGroupAddon>
  <InputGroupInput id="item-link" />
</InputGroup>
```

Do not position icons manually inside inputs.

Validation mapping:

- Server/core errors with `fieldPath` should map to the closest visible field.
- Unknown field errors should render in an `Alert` near the top of the editor
  panel or canvas.
- Field errors should clear when the field changes, or when the server returns
  a successful saved snapshot.
- Validation should never be represented only by disabling Save.

## Icon Policy

Use the project-configured shadcn icon library. If the project config says
`lucide`, use `lucide-react`.

For buttons:

```tsx
<Button>
  <SaveIcon data-icon="inline-start" />
  Save
</Button>
```

Do not manually size icons inside buttons. Component CSS should handle icon
sizing.

Do not use Material Symbols from the prototype.

Icon usage should be consistent:

- `SaveIcon` for Save.
- `EyeIcon` for Preview.
- `PlusIcon` for New Collection/Add Item/Add Section.
- `GripVerticalIcon` for drag handles.
- `PencilIcon` for edit title.
- `LinkIcon` in the link input group.
- `UploadIcon` and `CropIcon` for image controls.
- `TrashIcon` for remove item.

Do not use a string-to-icon lookup for these. Import and pass icon components
directly.

## Interaction Design

### First Run

If no collections exist:

- Show an `Empty` state in the canvas area.
- Primary action: create collection.
- Do not show a marketing page.
- Do not require navigating to another screen.
- After creation, open the new collection directly in the editor.

### Create Collection

Preferred interaction:

- Top bar `New Collection` opens a small `Dialog`.
- The dialog asks for a title.
- Creating collection calls the server.
- Server response becomes the source of truth.
- New collection opens immediately.
- The server/core path creates the stable slug-safe collection ID.
- The new collection should include the starter section required by the domain
  model.
- The UI should not fabricate persisted IDs with ad hoc string manipulation.

Fast path:

- If we keep one-click creation, immediately create `Untitled Collection` and
  focus the collection title field.

### Edit Collection Title

The active collection title should be editable in the top bar or with an edit
icon that opens inline editing.

Requirements:

- Stable collection ID does not change just because title changes.
- Save state becomes dirty.
- Validation errors come from server/core validation.

### Add Section

Add section should be available near the section list, not hidden in a menu.

New sections should:

- Have a stable generated ID.
- Start with editable title focused where practical.
- Preserve existing section order.

### Add Item

The add-item tile should be part of each section's grid.

Clicking it should:

- Create a new draft item in that section through core/browser operations.
- Select the new item.
- Open/focus the item editor panel.

### Select Item

Clicking a card should:

- Mark that card selected.
- Show its fields in the editor panel.
- Preserve unsaved draft state.

Selected state should be visible through border/ring treatment, not only the
editor panel content.

### Upload Image

Image upload lives in the item editor.

Requirements:

- Use server asset API.
- Store returned image reference in draft item state.
- Preserve original source image.
- Preserve default crop metadata returned by the server/core path.
- Show upload errors as `Alert` or field-level messages.
- Keep final generated image output server-driven.
- Do not hard-code image-processing limits in React. If the server exposes
  upload policy such as the 20 MB v1 limit, the UI may display it as helper
  text; enforcement remains server-side.
- Client-side file checks may improve feedback, but server validation remains
  authoritative.

### Crop Image

Crop opens a `Dialog` or nested crop surface from the editor panel.

Requirements:

- Use `react-easy-crop`.
- Square crop frame, `aspect={1}`.
- Use shadcn `Slider` for zoom.
- No rotation controls in version 1.
- Persist crop as percentage metadata.
- Apply should always be deterministic, even if the image has not moved.

### Save

Save is explicit.

Requirements:

- Save button in top bar.
- Saved/dirty/saving status visible but not loud.
- Server response becomes post-save source of truth.
- Save should not silently discard local changes.
- Save failures should show structured messages.

### Feedback

Use persistent, local feedback for state the user must act on:

- Save state lives in the top bar.
- Field errors live next to fields.
- Screen-level failures use `Alert`.
- Empty and loading states use `Empty` and `Skeleton`.

Use `sonner` only for transient confirmation or non-blocking events, such as a
successful save or copied include snippet. Toasts must not be the only place
where validation errors or destructive consequences are communicated.

### Preview

Preview should:

- Save first if the current collection is dirty, or validate the saved snapshot.
- Surface renderable validation errors.
- Open `/preview/<collection-id>` as a full route.
- Never use React's editor grid as the final output.
- Use the same server/core renderer path as `gridgen build`.

### Build Awareness

The authoring UI should not include a version 1 Jekyll build/export control.
The primary workflow is:

```text
UI save
  -> persisted gridgen source workspace
  -> user runs gridgen build from the CLI
```

The UI may eventually show documentation or a copyable include snippet after a
successful save/build workflow exists, but it must not imply that React is
producing the generated Jekyll assets.

### Reorder

Use `dnd-kit` for drag and drop.

Also provide non-drag controls where practical:

- move section up/down
- move item left/right
- move item to another section if feasible

Requirements:

- Stable IDs preserved.
- Order saved deterministically.
- Reorder operations routed through core/browser operations.
- Keyboard and pointer behavior should be tested through user-visible effects.

## Accessibility

Accessibility is part of correctness.

Requirements:

- Every `Dialog`, `Sheet`, and `Drawer` has a title.
- Icon-only buttons have accessible names.
- Forms use labels, not placeholder-only fields.
- Invalid fields use `aria-invalid`.
- Field groups use semantic shadcn form components.
- Drag handles are buttons, not anonymous spans.
- Keyboard users can create, edit, save, and preview a collection.
- Focus should move intentionally when opening dialogs/sheets.
- Focus should return sensibly after closing overlays.
- Color must not be the only indicator for validation or selection.

## Empty, Loading, Error, And Disabled States

### Empty

Use `Empty`.

Cases:

- No collections.
- No selected item.
- Section has no items.

### Loading

Use `Skeleton` for loading collection lists or initial app boot.

Avoid layout jumps. Skeleton dimensions should approximate the final layout.

### Error

Use `Alert` for screen-level or panel-level failures.

Use `FieldDescription` for field-specific failures.

Error messages should come from serialized `GridgenError` responses when
possible.

### Disabled

Disabled controls should reflect actual unavailable operations, not hide them
prematurely.

Examples:

- Save disabled while saving.
- Crop disabled until an image exists.
- Move up disabled for the first section.

## Data And State Boundaries

The UI should have a clear state model:

```text
Server snapshot
  -> browser draft state
  -> user edits
  -> explicit save
  -> server response replaces saved snapshot
```

Recommended app state:

- bootstrap data
- collection summaries
- current persisted snapshot
- current draft snapshot
- selected item ID
- save state
- field errors
- request failures
- upload/crop transient state

Avoid storing the same fact in multiple shapes. If UI convenience requires a
derived shape, make the conversion explicit and tested through public helpers.

## Browser API Layer

The browser API client should be the only UI layer that knows route URLs and
headers.

It should:

- Use browser-safe DTOs from `@gridgen/core/browser`.
- Attach session token for mutating requests.
- Convert failed responses into typed UI failure state.
- Avoid throwing raw unknown values into components.

Components should receive callbacks or hooks, not construct fetch calls
directly.

## Styling Rules

Follow the repo-local shadcn styling policy:

- Use semantic colors.
- Use built-in component variants first.
- Use `className` for layout more than appearance.
- Use `gap-*`, never `space-x-*` or `space-y-*`.
- Use `size-*` when width and height are equal.
- Use `truncate` shorthand.
- Use `cn()` for conditional classes.
- Do not add manual z-index to overlay components.

If using Tailwind, keep classes systematic and readable. If using plain CSS,
keep semantic CSS variables and component classes organized by component.

The target should eventually be closer to standard shadcn/Tailwind conventions
than custom global CSS.

## What To Change From The Current UI

The current implementation should be considered functional but not final.

Needed changes:

- Replace hand-written shadcn-like primitives with CLI-managed shadcn
  components.
- Split the large `App.tsx` into product components.
- Move from current two-column/loose layout to the prototype's workbench shell.
- Replace custom empty/error/status markup with shadcn `Empty`, `Alert`,
  `Badge`, `Separator`, and related primitives.
- Refactor forms to `FieldGroup` and `Field`.
- Refactor link input to `InputGroup`.
- Make the right item editor a persistent desktop panel and responsive sheet.
- Update visual tokens to a neutral shadcn-like palette.
- Use lucide icons consistently with shadcn icon rules.
- Keep all existing behavior tests passing while improving component structure.

## What Not To Copy From The Prototype

Do not copy:

- Tailwind CDN setup.
- Google Fonts runtime imports.
- Material Symbols.
- Remote image URLs.
- Hardcoded Music/Movies/Games collections.
- Fake tags unless the domain schema intentionally adds tags.
- The mock Jekyll code preview as a required primary editor feature.

The prototype is a design reference, not production code.

## shadcn Upgrade Checklist

Before rebuilding a UI area, check whether shadcn already provides the app
pattern. The default answer should be to compose the shadcn primitive, not to
invent a local primitive.

- App navigation: `Sidebar`, `SidebarProvider`, `SidebarInset`,
  `SidebarTrigger`, `SidebarRail`.
- Adjacent action clusters: `ButtonGroup`.
- Overflow actions: `DropdownMenu`.
- Right-click mirrors for visible actions: `ContextMenu`.
- Icon-only explanations: `Tooltip`.
- Expand/collapse section bodies: `Collapsible`.
- Phone bottom editing: `Drawer`.
- Tablet/desktop side editing: `Sheet`.
- Focused tasks: `Dialog`.
- Destructive confirmation: `AlertDialog`.
- Transient notifications: `sonner`.
- Empty/loading/error states: `Empty`, `Skeleton`, `Alert`.
- Form structure: `Field`, `FieldGroup`, `InputGroup`, `Slider`.

If a developer chooses not to use a relevant shadcn component for one of these
patterns, they should document the concrete reason in the implementation notes.

## Testing And Verification

UI changes must be verified through user-visible behavior.

Required checks for substantial UI changes:

- `bun run check`
- `bun run coverage`
- `bun run e2e`

E2E should cover:

- first local run
- collapse and expand the desktop sidebar
- resize the desktop item editor within allowed bounds
- create collection
- edit collection and section
- add item
- upload image
- crop image
- save
- preview
- build generated Jekyll output through the CLI after UI-authored source data
  is saved

For visual/layout changes, add manual verification notes covering:

- desktop width
- desktop collapsed-sidebar state
- desktop resized-inspector state
- narrow desktop/tablet width
- mobile width
- resized browser behavior
- selected item editor behavior
- long titles/descriptions
- missing images
- validation errors

Use Playwright screenshots where visual regressions are likely. Screenshots are
not a substitute for assertions, but they are useful for checking professional
layout quality.

## Implementation Sequence

Recommended sequence for the redesign:

1. Initialize shadcn properly in `apps/web`.
2. Add the shadcn components needed for the shell, collapsible sidebar, forms,
   alerts, badges, menus, button groups, collapsible sections, resizable
   inspector, and overlays.
3. Establish semantic design tokens and global styling.
4. Extract current `App.tsx` into app shell, top bar, sidebar, canvas, section,
   card, editor, and crop components.
5. Rebuild the shell layout around `SidebarProvider`, `Sidebar`, and
   `SidebarInset`.
6. Refactor item editor forms to shadcn `Field` primitives.
7. Refactor empty/error/status displays to shadcn primitives.
8. Refactor icons and buttons to match shadcn icon/button rules.
9. Add section/item `DropdownMenu` and optional mirrored `ContextMenu`
   actions.
10. Add image `ButtonGroup`, section `Collapsible`, bounded editor
    `Resizable`, and phone `Drawer` behavior.
11. Improve responsive behavior for sidebar and editor panel.
12. Re-run check, coverage, and E2E.
13. Review screenshots at multiple viewport widths and sidebar states.

Do not combine shadcn initialization, visual redesign, large state changes, and
new product scope in one uncontrolled patch. Keep changes reviewable.

## Open Product Decisions

These are not blockers for the core redesign, but should be decided before
implementing them:

- Tags/categories: the prototype includes tags, but the v1 schema does not.
  Leave out unless the domain model is intentionally extended.
- Collection icons/types: the prototype shows music/movie/game icons. Use a
  generic icon unless collection type becomes real data.
- Integration snippet panel: useful later, but not required in the primary
  editor. If added, use shadcn `Dialog`, `Card`, `Button`, and `sonner` copy
  feedback rather than a custom callout.
- Dark mode: the tokens should support it, but v1 can remain light-only unless
  explicitly prioritized.

## Definition Of Done For UI Quality

A UI implementation is not done until:

- It uses real shadcn primitives where appropriate.
- It uses shadcn `Sidebar` for collapsible collection navigation.
- It uses shadcn menus for secondary section and item actions.
- It uses shadcn `ButtonGroup` for image editing actions.
- It uses shadcn `Collapsible` for section body collapse.
- It uses bounded shadcn `Resizable` behavior for desktop inspector resizing.
- It is split into clear product components.
- It preserves core/server/io boundaries.
- It works at desktop, tablet, and mobile widths.
- Text does not overflow incoherently.
- Controls have stable dimensions and accessible names.
- Field validation is visible and accessible.
- Save, preview, upload, crop, and reorder flows work through real APIs.
- Preview still uses the server/core renderer path.
- E2E covers the main authoring flow.
- QA scripts pass, or any exception is explicitly documented and approved.
