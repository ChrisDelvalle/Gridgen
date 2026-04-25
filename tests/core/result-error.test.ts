import {
  createAssetError,
  createFilesystemError,
  createGridgenError,
  createPathError,
  createRenderError,
  createServerError,
  createValidationError,
  err,
  GridgenErrorCode,
  isErr,
  isOk,
  ok,
  serializeGridgenError
} from "@gridgen/core";
import { describe, expect, test } from "bun:test";

describe("Result", () => {
  test("wraps successful values", () => {
    const result = ok({ value: "music" });

    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);

    if (isOk(result)) {
      expect(result.value.value).toBe("music");
    }
  });

  test("wraps expected failures", () => {
    const result = err(
      createValidationError(GridgenErrorCode.CollectionEmptyTitle, "Collection title is required.")
    );

    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);

    if (isErr(result)) {
      expect(result.error.code).toBe(GridgenErrorCode.CollectionEmptyTitle);
    }
  });
});

describe("Gridgen errors", () => {
  test("constructs browser-safe errors with safe context", () => {
    const error = createGridgenError(GridgenErrorCode.ItemInvalidLink, "Item link is invalid.", {
      collectionId: "music",
      fieldPath: "sections.0.items.0.link",
      itemId: "album-a",
      sectionId: "s-tier"
    });

    expect(error).toEqual({
      code: GridgenErrorCode.ItemInvalidLink,
      context: {
        collectionId: "music",
        fieldPath: "sections.0.items.0.link",
        itemId: "album-a",
        sectionId: "s-tier"
      },
      message: "Item link is invalid."
    });
  });

  test("serializes without exception-only fields", () => {
    const error = createFilesystemError(
      GridgenErrorCode.FilesystemWriteFailed,
      "Could not write the collection.",
      {
        displayPath: "collections/music.json"
      }
    );

    expect(serializeGridgenError(error)).toEqual({
      code: GridgenErrorCode.FilesystemWriteFailed,
      context: {
        displayPath: "collections/music.json"
      },
      message: "Could not write the collection."
    });
  });

  test("constructs category-specific errors", () => {
    expect(
      createValidationError(GridgenErrorCode.CollectionInvalidJson, "Invalid JSON.").code
    ).toBe(GridgenErrorCode.CollectionInvalidJson);
    expect(createAssetError(GridgenErrorCode.AssetTooLarge, "Image is too large.").code).toBe(
      GridgenErrorCode.AssetTooLarge
    );
    expect(createPathError(GridgenErrorCode.PathUnsafe, "Path is unsafe.").code).toBe(
      GridgenErrorCode.PathUnsafe
    );
    expect(createRenderError(GridgenErrorCode.RenderNotRenderable, "Not renderable.").code).toBe(
      GridgenErrorCode.RenderNotRenderable
    );
    expect(createServerError(GridgenErrorCode.ServerUnauthorized, "Unauthorized.").code).toBe(
      GridgenErrorCode.ServerUnauthorized
    );
  });
});
