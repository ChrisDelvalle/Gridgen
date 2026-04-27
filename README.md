# Gridgen

Gridgen is a Bun-first TypeScript tool for authoring recommendation grids and
building static assets for Astro and Jekyll.

The default build target is Astro React. The default visual layout is the
opinionated `/mu/core`-style poster grid.

## Installation

During alpha development, install from a pinned GitHub tag or commit:

```sh
bun add -d github:ChrisDelvalle/Gridgen#v0.0.1-alpha.1
```

GitHub-installed alpha builds run through Bun's local binary resolution:

```sh
bun run gridgen run --open
bun run gridgen build ./gridgen .
```

For local testing from a checked-out repository, install by filesystem path:

```sh
bun add -d /Users/irk/Developer/JAVASCRIPT/gridgen
```

After a registry release, the intended stable usage is:

```sh
bunx gridgen run --open
```

For local development inside this repository:

```sh
bun install
bun run gridgen run --open
```

Astro React output assumes the target Astro project is already configured for
React, such as through `@astrojs/react`.

## Authoring

Start the local authoring UI:

```sh
bun run gridgen run --open
```

By default, `gridgen run` uses `./gridgen` as the source workspace. The UI lets
you create collections, add sections and items, upload images, crop square
previews, save, and open the static preview route.

## Build For Astro

Build saved collections into an Astro project:

```sh
bun run gridgen build ./gridgen ./my-astro-site
```

The command discovers every JSON file in `./gridgen/collections`, processes
images, and writes reusable Astro React assets:

```text
my-astro-site/
  src/
    gridgen/
      GridgenRecommendationGrid.tsx
      gridgen.css
      music.json
  public/
    gridgen/
      assets/
        music/
          album-a.webp
```

Use the generated component, data, and CSS from an Astro page:

```astro
---
import GridgenRecommendationGrid from "../gridgen/GridgenRecommendationGrid";
import music from "../gridgen/music.json";
import "../gridgen/gridgen.css";
---

<GridgenRecommendationGrid collection={music} />
```

Hydration is optional and remains an Astro callsite decision:

```astro
<GridgenRecommendationGrid collection={music} client:visible />
```

The generated CSS is ordinary namespaced CSS, not Tailwind. You can replace or
override `gridgen.css`, or swap in a different generated collection JSON while
reusing the same component.

## Build For Jekyll

Jekyll output is still supported explicitly:

```sh
bun run gridgen build --target jekyll ./gridgen ./my-jekyll-blog
```

This writes only Gridgen-owned output paths:

```text
my-jekyll-blog/
  _includes/
    gridgen/
      music.html
  assets/
    gridgen/
      gridgen.css
      music/
        album-a.webp
```

Use the generated include from a Jekyll page or post:

```liquid
{% include gridgen/music.html %}
```

## Layouts

Poster layout is the default:

```sh
bun run gridgen build ./gridgen ./my-astro-site
```

Use the simpler classic layout explicitly:

```sh
bun run gridgen build --layout classic ./gridgen ./my-astro-site
```

Repeated builds with unchanged input should produce stable output.

## Example

Build the included sample grid into the included Astro target:

```sh
bun run gridgen build examples/sample-grid examples/astro-site
```

Build the same sample into the included minimal Jekyll target:

```sh
bun run gridgen build --target jekyll examples/sample-grid examples/jekyll-site
```

The source example lives in `examples/sample-grid/`.

## Source Workspace

A source workspace contains draft collections and original source images:

```text
gridgen/
  collections/
    music.json
  assets/
    music/
      sources/
        album-a.png
  .trash/
```

Collection JSON is the source of truth. Source images are preserved so future
crop edits can be generated from the original upload.

## Dependency Policy

Dependencies are added only when a milestone actively uses them. Current
production dependencies are intentionally scoped:

- `zod`: collection schema parsing and boundary validation.
- `commander`: CLI command parsing.
- `sharp`: local image metadata, crop, resize, and WebP generation.
- `hono`: loopback-only local authoring server.
- `react`, `react-dom`, and `vite`: authoring UI.
- Radix/shadcn-style primitives: common accessible UI controls.
- `react-easy-crop`: square crop editor interaction.
- `dnd-kit`: section and item reordering.

Do not add analytics, telemetry, hosted services, or remote-code loading without
explicit approval.

## Quality

For normal code changes, run:

```sh
bun run check
```

Coverage should come from meaningful behavior tests through public interfaces:

```sh
bun run coverage
```
