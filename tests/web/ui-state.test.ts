import { describe, expect, test } from "bun:test";

import {
  getFieldError,
  getItemActionAvailability,
  selectEditorMode
} from "../../apps/web/src/lib/ui-state";

describe("editor mode selection", () => {
  test("uses a phone drawer below the phone breakpoint", () => {
    expect(selectEditorMode(390)).toBe("phone");
    expect(selectEditorMode(639)).toBe("phone");
  });

  test("uses a tablet sheet when the persistent inspector would crowd the canvas", () => {
    expect(selectEditorMode(640)).toBe("tablet");
    expect(selectEditorMode(1024)).toBe("tablet");
    expect(selectEditorMode(1099)).toBe("tablet");
  });

  test("uses the persistent desktop inspector at wide workbench widths", () => {
    expect(selectEditorMode(1100)).toBe("desktop");
    expect(selectEditorMode(1440)).toBe("desktop");
  });
});

describe("item action availability", () => {
  test("disables backward movement for the first item in the first section", () => {
    expect(
      getItemActionAvailability({
        itemCount: 3,
        itemIndex: 0,
        link: "",
        sectionCount: 2,
        sectionIndex: 0
      })
    ).toEqual({
      canMoveLeft: false,
      canMoveRight: true,
      canMoveToNextSection: true,
      canMoveToPreviousSection: false,
      canOpenLink: false
    });
  });

  test("disables forward movement for the last item in the last section", () => {
    expect(
      getItemActionAvailability({
        itemCount: 3,
        itemIndex: 2,
        link: " /albums/neon-pulse ",
        sectionCount: 2,
        sectionIndex: 1
      })
    ).toEqual({
      canMoveLeft: true,
      canMoveRight: false,
      canMoveToNextSection: false,
      canMoveToPreviousSection: true,
      canOpenLink: true
    });
  });
});

describe("field error lookup", () => {
  test("returns the matching error message", () => {
    const fieldErrors = new Map([["item.link", "Link is invalid."]]);

    expect(getFieldError(fieldErrors, "item.link")).toBe("Link is invalid.");
  });

  test("returns undefined for fields without an error", () => {
    const fieldErrors = new Map([["item.title", "Title is required."]]);

    expect(getFieldError(fieldErrors, "item.link")).toBeUndefined();
  });
});
