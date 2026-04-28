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

Astro output requires the target Astro project to support React. MDX is only
needed when embedding a grid directly inside Markdown-style article content:

```sh
bunx astro add react
bunx astro add mdx
```

Skip `bunx astro add mdx` if you only render grids from `.astro` pages or
layouts.

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

Configure a stable import alias once in the Astro project:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@gridgen/*": ["src/gridgen/*"]
    }
  }
}
```

Preserve any existing `extends`, `compilerOptions`, or project-specific
settings already in your `tsconfig.json`. Astro supports aliases from
`tsconfig.json` or `jsconfig.json`; use the same `compilerOptions` block in
`jsconfig.json` for JavaScript-only projects.

Use the generated component, data, and CSS from an Astro page:

```astro
---
import GridgenRecommendationGrid from "@gridgen/GridgenRecommendationGrid";
import music from "@gridgen/music.json";
import "@gridgen/gridgen.css";
---

<GridgenRecommendationGrid collection={music} />
```

No `client:*` directive is needed for the current grid because it renders static
React output. Use one only if the generated component becomes interactive later:

```astro
<GridgenRecommendationGrid collection={music} client:visible />
```

The generated CSS is ordinary namespaced CSS, not Tailwind. You can replace or
override `gridgen.css`, or swap in a different generated collection JSON while
reusing the same component.

## Astro MDX Articles

Use `.mdx` files for Markdown-style articles that embed React components in the
article body. This keeps normal Markdown authoring while allowing a generated
Gridgen component to appear between paragraphs.

Start from a target Astro project:

```sh
bun add -d github:ChrisDelvalle/Gridgen#v0.0.1-alpha.1
bunx astro add react
bunx astro add mdx
bun run gridgen run --open
bun run gridgen build ./gridgen .
```

Configure the `@gridgen/*` alias:

```jsonc
// tsconfig.json or jsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@gridgen/*": ["src/gridgen/*"]
    }
  }
}
```

Then create an MDX article such as `docs/hello-world.mdx`:

```mdx
---
title: Hello World
date: 2026-04-27
description: A small article with an embedded recommendation grid.
---

import GridgenRecommendationGrid from "@gridgen/GridgenRecommendationGrid";
import myFavoriteMusic from "@gridgen/my-favorite-music.json";
import "@gridgen/gridgen.css";

This is a normal Markdown paragraph before the grid.

The grid below is rendered from the generated Gridgen collection JSON.

<GridgenRecommendationGrid collection={myFavoriteMusic} />

The article continues with more Markdown after the grid.
```

Grid images are public assets referenced by generated JSON, such as
`/gridgen/assets/my-favorite-music/...`. Run `bun run gridgen build ./gridgen .`
again after saving Gridgen changes, then run the Astro project build or dev
server normally.

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
