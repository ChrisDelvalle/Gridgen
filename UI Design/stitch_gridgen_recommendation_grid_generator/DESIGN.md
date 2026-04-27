---
name: Gridgen Design System
colors:
  surface: "#fdf8f8"
  surface-dim: "#ddd9d9"
  surface-bright: "#fdf8f8"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f7f3f2"
  surface-container: "#f1edec"
  surface-container-high: "#ebe7e7"
  surface-container-highest: "#e5e2e1"
  on-surface: "#1c1b1b"
  on-surface-variant: "#47464a"
  inverse-surface: "#313030"
  inverse-on-surface: "#f4f0ef"
  outline: "#78767b"
  outline-variant: "#c8c5ca"
  surface-tint: "#5f5e60"
  primary: "#000000"
  on-primary: "#ffffff"
  primary-container: "#1c1b1d"
  on-primary-container: "#858386"
  inverse-primary: "#c8c6c8"
  secondary: "#5d5e60"
  on-secondary: "#ffffff"
  secondary-container: "#dfdfe0"
  on-secondary-container: "#616364"
  tertiary: "#000000"
  on-tertiary: "#ffffff"
  tertiary-container: "#1f1a1a"
  on-tertiary-container: "#8a8282"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#e5e1e4"
  primary-fixed-dim: "#c8c6c8"
  on-primary-fixed: "#1c1b1d"
  on-primary-fixed-variant: "#474649"
  secondary-fixed: "#e2e2e3"
  secondary-fixed-dim: "#c6c6c7"
  on-secondary-fixed: "#1a1c1d"
  on-secondary-fixed-variant: "#454748"
  tertiary-fixed: "#ebe0df"
  tertiary-fixed-dim: "#cec4c4"
  on-tertiary-fixed: "#1f1a1a"
  on-tertiary-fixed-variant: "#4c4545"
  background: "#fdf8f8"
  on-background: "#1c1b1b"
  surface-variant: "#e5e2e1"
typography:
  h1:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: "600"
    lineHeight: 36px
    letterSpacing: -0.025em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.02em
  h3:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: -0.02em
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 20px
  code:
    fontFamily: monospace
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  container-max: 1200px
---

## Brand & Style

This design system is built for technical precision and developer productivity. The aesthetic is rooted in **Minimalism** and **Modern Corporate** styles, heavily influenced by the Vercel and shadcn/ui ecosystems. The goal is to create a "UI that disappears," allowing the user’s content—the Jekyll recommendation grids—to take center stage.

The brand personality is authoritative, functional, and invisible. It prioritizes clarity over decoration, using ample whitespace and high-quality typography to establish hierarchy. The interface should feel like a high-end IDE: snappy, predictable, and robust.

## Colors

The palette is strictly monochromatic, utilizing the standard shadcn/ui neutral scale to maintain a professional, utilitarian feel.

- **Primary:** High-contrast black (`#09090b`) for main actions and text.
- **Secondary/Accent:** Soft grays for hover states and secondary buttons, ensuring the interface remains calm.
- **Borders:** Subtle zinc/slate tones are used to define structure without adding visual noise.
- **Feedback:** Destructive actions use a standard red, while success and info states should rely on typography and iconography rather than heavy background fills.

The default mode is **Light**, though the palette is designed to be easily inverted for a Dark mode using the same semantic tokens.

## Typography

This system utilizes **Inter** for all UI elements to ensure maximum legibility and a systematic, utilitarian appearance. The scale is tight, avoiding extreme size variations to keep the tool feeling compact and data-dense.

- **Tracking:** Headings use slight negative letter-spacing to appear more cohesive.
- **Monospace:** For Jekyll front-matter snippets or grid configurations, a standard monospace stack is used to signal "code" and "editable data."
- **Weights:** Use Medium (500) for labels and Semi-Bold (600) for headers to create hierarchy without relying on color.

## Layout & Spacing

The design system employs a **Fixed Grid** philosophy for the main application shell, ensuring a stable environment for authoring. Content is centered within a 1200px container for focused work.

- **8pt Grid:** All dimensions and padding follow a strict 4px/8px increment system.
- **Rhythm:** Use `16px` (md) for standard padding between functional groups and `24px` (lg) for section spacing.
- **Gridgen Specifics:** The recommendation grids themselves should be displayed in a responsive CSS grid, but the authoring sidebars and toolbars remain fixed in width to provide a reliable target for mouse interaction.

## Elevation & Depth

To maintain a flat, modern aesthetic, depth is communicated through **Low-contrast outlines** and **Tonal layers** rather than heavy shadows.

- **Layers:** Use a light gray background (`#f9f9fb`) for the application canvas and pure white (`#ffffff`) for the actual cards or work areas.
- **Borders:** 1px solid borders (`#e4e4e7`) are the primary method for separating components.
- **Shadows:** When necessary (e.g., dropdowns or modals), use a single, ultra-diffused shadow: `0 10px 15px -3px rgb(0 0 0 / 0.1)`. Avoid shadows on standard buttons and inputs.

## Shapes

The shape language is **Soft** but precise.

- **Radius:** A standard corner radius of `0.25rem` (4px) is used for inputs, buttons, and small components.
- **Large Components:** Cards and main containers may use `0.5rem` (8px) to provide a subtle distinction from UI controls.
- **Consistency:** Avoid pill-shaped buttons; use the standard soft-rect shape to maintain the "tool" aesthetic.

## Components

### Buttons

- **Primary:** Black background, white text. No shadow.
- **Secondary:** Light gray background, black text. Becomes slightly darker on hover.
- **Outline:** Transparent background, 1px border.

### Inputs & Selects

- Use a 1px border. On focus, apply a subtle 2px ring or a solid black border.
- Placeholder text must be light gray (`#a1a1aa`).

### Cards (Grid Items)

- Recommendation grid items should use a subtle 1px border.
- On hover, the border color should shift to a darker gray or primary black to indicate interactivity.

### Data Displays

- Use "Chips" (Badges) with a secondary gray background and `body-sm` typography for Jekyll tags or categories.
- Lists should have 1px horizontal dividers and generous 12px vertical padding.

### Specialized Components

- **Code Preview:** A dedicated section with a syntax-highlighted block for Jekyll Liquid tags or YAML front-matter, using a slightly darker background to distinguish it from the UI.
- **Toolbar:** A sticky top-bar or sidebar with icon-only or icon+label actions, separated by a vertical border.
