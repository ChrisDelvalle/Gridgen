/**
 * Editor presentation mode selected from available viewport width.
 */
export type EditorMode = "desktop" | "tablet" | "phone";

/**
 * Public state needed to decide whether an item action is currently valid.
 */
interface ItemActionAvailabilityInput {
  /** The item's zero-based position inside its current section. */
  readonly itemIndex: number;
  /** Number of items in the item's current section. */
  readonly itemCount: number;
  /** The current section's zero-based position. */
  readonly sectionIndex: number;
  /** Number of sections in the active collection. */
  readonly sectionCount: number;
  /** The current item link text. */
  readonly link: string;
}

/**
 * Menu action availability for an item card.
 */
interface ItemActionAvailability {
  /** Whether the item can move left inside its current section. */
  readonly canMoveLeft: boolean;
  /** Whether the item can move right inside its current section. */
  readonly canMoveRight: boolean;
  /** Whether the item can move to the previous section. */
  readonly canMoveToPreviousSection: boolean;
  /** Whether the item can move to the next section. */
  readonly canMoveToNextSection: boolean;
  /** Whether the item has a non-empty link that can be opened. */
  readonly canOpenLink: boolean;
}

/**
 * Selects the editor mode for a viewport width.
 *
 * @param viewportWidth Viewport width in CSS pixels.
 * @returns The editor mode that preserves the most usable canvas.
 */
export function selectEditorMode(viewportWidth: number): EditorMode {
  if (viewportWidth < 640) {
    return "phone";
  }

  if (viewportWidth < 1100) {
    return "tablet";
  }

  return "desktop";
}

/**
 * Computes item menu availability from public draft state.
 *
 * @param input Public state for the item and its section.
 * @returns Available item actions.
 */
export function getItemActionAvailability(
  input: ItemActionAvailabilityInput
): ItemActionAvailability {
  return {
    canMoveLeft: input.itemIndex > 0,
    canMoveRight: input.itemIndex < input.itemCount - 1,
    canMoveToNextSection: input.sectionIndex < input.sectionCount - 1,
    canMoveToPreviousSection: input.sectionIndex > 0,
    canOpenLink: input.link.trim().length > 0
  };
}

/**
 * Reads a field error without exposing mutable map behavior to UI components.
 *
 * @param fieldErrors Field error map.
 * @param path Field path to read.
 * @returns The field message when present.
 */
export function getFieldError(
  fieldErrors: ReadonlyMap<string, string>,
  path: string
): string | undefined {
  return fieldErrors.get(path);
}
