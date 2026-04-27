# Gridgen

Gridgen is a Bun-first TypeScript tool for authoring recommendation grids and
building static Jekyll assets.

## Local Workflow

Install dependencies:

```sh
bun install
```

Start the local authoring UI:

```sh
bun run gridgen run --open
```

By default, `gridgen run` uses `./gridgen` as the source workspace. The UI lets
you create collections, add sections and items, upload images, crop square
previews, save, and open the static preview route.

Build saved collections into a Jekyll site:

```sh
bun run gridgen build ./gridgen ./my-jekyll-blog
```

The default build uses the classic embeddable grid layout. To generate the
opinionated `/mu/core`-style poster layout used by the preview route:

```sh
bun run gridgen build --layout poster ./gridgen ./my-jekyll-blog
```

Use the generated include from a Jekyll page or post:

```liquid
{% include gridgen/music.html %}
```

## Example

Build the included sample grid into the included minimal Jekyll target:

```sh
bun run gridgen build examples/sample-grid examples/jekyll-site
```

The source example lives in `examples/sample-grid/`. The Jekyll target lives in
`examples/jekyll-site/`.

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

## Generated Jekyll Output

`gridgen build <source> <jekyll-site>` writes only Gridgen-owned output paths:

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

Repeated builds with unchanged input should produce stable output.

Generated includes are transparent by default so they can sit inside a Jekyll
theme. The local preview route wraps the same generated poster layout in a
black preview shell; the black background is preview-only and is not baked into
the include.

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
