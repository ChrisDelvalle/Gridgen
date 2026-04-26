import {
  CollectionOperationType,
  createCollectionDraft,
  type DraftCollection,
  type GridgenError,
  GridgenErrorCode,
  isErr,
  isOk,
  normalizeSlug,
  parseDraftCollection,
  parseDraftLink,
  type Result,
  updateCollection
} from "@gridgen/core";
import { describe, expect, test } from "bun:test";

describe("collection draft creation", () => {
  test("creates a collection with a starter section and slug-safe ID", () => {
    const collection = unwrapOk(
      createCollectionDraft({
        title: "  Music Recs  "
      })
    );

    expect(collection.id.value).toBe("music-recs");
    expect(collection.title).toBe("Music Recs");
    expect(collection.sections).toHaveLength(1);
    expect(collection.sections[0]?.id.value).toBe("section-1");
    expect(collection.sections[0]?.name).toBe("Section 1");
  });

  test("suffixes collection IDs when reserved IDs already exist", () => {
    const collection = unwrapOk(
      createCollectionDraft({
        reservedIds: [{ value: "music" }, { value: "music-2" }],
        title: "Music"
      })
    );

    expect(collection.id.value).toBe("music-3");
  });

  test("rejects empty collection titles", () => {
    const error = unwrapErr(
      createCollectionDraft({
        title: "   "
      })
    );

    expect(error.code).toBe(GridgenErrorCode.CollectionEmptyTitle);
  });

  test("rejects titles that cannot produce a slug-safe identifier", () => {
    const error = unwrapErr(
      createCollectionDraft({
        title: "!!!"
      })
    );

    expect(error.code).toBe(GridgenErrorCode.CollectionEmptyTitle);
  });
});

describe("slug normalization", () => {
  test("normalizes display text into slug-safe identifiers", () => {
    expect(unwrapOk(normalizeSlug(" Bjork's Best Albums! ")).value).toBe("bjork-s-best-albums");
  });
});

describe("section operations", () => {
  test("adds sections with unique generated IDs", () => {
    const collection = createBaseCollection();
    const withBlankSection = unwrapOk(
      updateCollection(collection, {
        name: "",
        type: CollectionOperationType.AddSection
      })
    );
    const withSecondBlankSection = unwrapOk(
      updateCollection(withBlankSection, {
        name: "",
        type: CollectionOperationType.AddSection
      })
    );

    expect(withSecondBlankSection.sections.map((section) => section.id.value)).toEqual([
      "section-1",
      "section",
      "section-2"
    ]);
  });

  test("renames sections without changing their IDs", () => {
    const collection = createBaseCollection();
    const sectionId = firstSection(collection).id;
    const renamed = unwrapOk(
      updateCollection(collection, {
        name: "S Tier",
        sectionId,
        type: CollectionOperationType.RenameSection
      })
    );

    expect(renamed.sections[0]?.id.value).toBe(sectionId.value);
    expect(renamed.sections[0]?.name).toBe("S Tier");
  });

  test("reorders and removes sections with typed failures", () => {
    const collection = unwrapOk(
      updateCollection(createBaseCollection(), {
        name: "A Tier",
        type: CollectionOperationType.AddSection
      })
    );
    const secondSectionId = collection.sections[1]?.id;

    if (secondSectionId === undefined) {
      throw new Error("Expected second section.");
    }

    const reordered = unwrapOk(
      updateCollection(collection, {
        sectionId: secondSectionId,
        toIndex: 0,
        type: CollectionOperationType.ReorderSection
      })
    );

    expect(reordered.sections[0]?.id.value).toBe(secondSectionId.value);

    const lastSectionFailure = unwrapErr(
      updateCollection(createBaseCollection(), {
        sectionId: firstSection(createBaseCollection()).id,
        type: CollectionOperationType.RemoveSection
      })
    );

    expect(lastSectionFailure.code).toBe(GridgenErrorCode.SectionCannotRemoveLast);

    const removed = unwrapOk(
      updateCollection(collection, {
        sectionId: secondSectionId,
        type: CollectionOperationType.RemoveSection
      })
    );

    expect(removed.sections).toHaveLength(1);
  });

  test("returns typed failures for missing sections and no-op reorders", () => {
    const collection = createBaseCollection();
    const sectionFailure = unwrapErr(
      updateCollection(collection, {
        name: "S Tier",
        sectionId: { value: "missing-section" },
        type: CollectionOperationType.RenameSection
      })
    );
    const reordered = unwrapOk(
      updateCollection(collection, {
        sectionId: firstSection(collection).id,
        toIndex: 0,
        type: CollectionOperationType.ReorderSection
      })
    );
    const missingReorderFailure = unwrapErr(
      updateCollection(collection, {
        sectionId: { value: "missing-section" },
        toIndex: 0,
        type: CollectionOperationType.ReorderSection
      })
    );
    const missingRemoveFailure = unwrapErr(
      updateCollection(collection, {
        sectionId: { value: "missing-section" },
        type: CollectionOperationType.RemoveSection
      })
    );

    expect(sectionFailure.code).toBe(GridgenErrorCode.SectionNotFound);
    expect(missingReorderFailure.code).toBe(GridgenErrorCode.SectionNotFound);
    expect(missingRemoveFailure.code).toBe(GridgenErrorCode.SectionNotFound);
    expect(reordered).toEqual(collection);
  });
});

describe("item operations", () => {
  test("adds items with stable generated IDs", () => {
    const collection = createBaseCollection();
    const sectionId = firstSection(collection).id;
    const withFirstItem = unwrapOk(
      updateCollection(collection, {
        sectionId,
        title: "Album A",
        type: CollectionOperationType.AddItem
      })
    );
    const withSecondItem = unwrapOk(
      updateCollection(withFirstItem, {
        sectionId,
        title: "Album A",
        type: CollectionOperationType.AddItem
      })
    );
    const withBlankItem = unwrapOk(
      updateCollection(withSecondItem, {
        sectionId,
        title: "",
        type: CollectionOperationType.AddItem
      })
    );

    expect(firstSection(withBlankItem).items.map((item) => item.id.value)).toEqual([
      "album-a",
      "album-a-2",
      "item"
    ]);
    expect(firstSection(withBlankItem).items[2]?.link).toEqual({ type: "empty" });
  });

  test("updates items without changing IDs and can clear optional fields", () => {
    const collection = createParsedCollection();
    const itemId = firstItem(collection).id;
    const updated = unwrapOk(
      updateCollection(collection, {
        itemId,
        patch: {
          description: null,
          image: null,
          link: unwrapOk(parseDraftLink("")),
          title: "Album A (Updated)"
        },
        type: CollectionOperationType.UpdateItem
      })
    );
    const item = firstItem(updated);

    expect(item.id.value).toBe(itemId.value);
    expect(item.title).toBe("Album A (Updated)");
    expect(item.description).toBeUndefined();
    expect(item.image).toBeUndefined();
    expect(item.link).toEqual({ type: "empty" });
  });

  test("moves, reorders, and removes items", () => {
    const sectioned = unwrapOk(
      updateCollection(createBaseCollection(), {
        name: "A Tier",
        type: CollectionOperationType.AddSection
      })
    );
    const primarySectionId = firstSection(sectioned).id;
    const secondarySectionId = secondSection(sectioned).id;
    const withItems = unwrapOk(
      updateCollection(
        unwrapOk(
          updateCollection(sectioned, {
            sectionId: primarySectionId,
            title: "Album A",
            type: CollectionOperationType.AddItem
          })
        ),
        {
          sectionId: primarySectionId,
          title: "Album B",
          type: CollectionOperationType.AddItem
        }
      )
    );
    const itemId = firstItem(withItems).id;

    const moved = unwrapOk(
      updateCollection(withItems, {
        itemId,
        toIndex: 99,
        toSectionId: secondarySectionId,
        type: CollectionOperationType.MoveItem
      })
    );

    expect(firstSection(moved).items.map((item) => item.id.value)).toEqual(["album-b"]);
    expect(secondSection(moved).items.map((item) => item.id.value)).toEqual(["album-a"]);

    const reordered = unwrapOk(
      updateCollection(withItems, {
        itemId: firstItem(withItems).id,
        toIndex: 1,
        type: CollectionOperationType.ReorderItem
      })
    );

    expect(firstSection(reordered).items.map((item) => item.id.value)).toEqual([
      "album-b",
      "album-a"
    ]);

    const removed = unwrapOk(
      updateCollection(withItems, {
        itemId,
        type: CollectionOperationType.RemoveItem
      })
    );

    expect(firstSection(removed).items.map((item) => item.id.value)).toEqual(["album-b"]);
  });

  test("returns typed not-found failures", () => {
    const collection = createBaseCollection();
    const sectionFailure = unwrapErr(
      updateCollection(collection, {
        sectionId: { value: "missing-section" },
        title: "Album A",
        type: CollectionOperationType.AddItem
      })
    );
    const itemFailure = unwrapErr(
      updateCollection(collection, {
        itemId: { value: "missing-item" },
        type: CollectionOperationType.RemoveItem
      })
    );

    expect(sectionFailure.code).toBe(GridgenErrorCode.SectionNotFound);
    expect(itemFailure.code).toBe(GridgenErrorCode.ItemNotFound);
  });

  test("routes same-section move requests through reordering and reports missing targets", () => {
    const collection = unwrapOk(
      updateCollection(
        unwrapOk(
          updateCollection(createBaseCollection(), {
            sectionId: firstSection(createBaseCollection()).id,
            title: "Album A",
            type: CollectionOperationType.AddItem
          })
        ),
        {
          sectionId: firstSection(createBaseCollection()).id,
          title: "Album B",
          type: CollectionOperationType.AddItem
        }
      )
    );
    const sameSectionMoved = unwrapOk(
      updateCollection(collection, {
        itemId: firstItem(collection).id,
        toIndex: 1,
        toSectionId: firstSection(collection).id,
        type: CollectionOperationType.MoveItem
      })
    );
    const missingItemFailure = unwrapErr(
      updateCollection(collection, {
        itemId: { value: "missing-item" },
        patch: {
          title: "Updated"
        },
        type: CollectionOperationType.UpdateItem
      })
    );
    const missingDestinationFailure = unwrapErr(
      updateCollection(collection, {
        itemId: firstItem(collection).id,
        toIndex: 0,
        toSectionId: { value: "missing-section" },
        type: CollectionOperationType.MoveItem
      })
    );
    const missingReorderFailure = unwrapErr(
      updateCollection(collection, {
        itemId: { value: "missing-item" },
        toIndex: 0,
        type: CollectionOperationType.ReorderItem
      })
    );
    const missingMoveItemFailure = unwrapErr(
      updateCollection(collection, {
        itemId: { value: "missing-item" },
        toIndex: 0,
        toSectionId: firstSection(collection).id,
        type: CollectionOperationType.MoveItem
      })
    );
    const noOpReorder = unwrapOk(
      updateCollection(collection, {
        itemId: firstItem(collection).id,
        toIndex: 0,
        type: CollectionOperationType.ReorderItem
      })
    );

    expect(firstSection(sameSectionMoved).items.map((item) => item.id.value)).toEqual([
      "album-b",
      "album-a"
    ]);
    expect(missingItemFailure.code).toBe(GridgenErrorCode.ItemNotFound);
    expect(missingDestinationFailure.code).toBe(GridgenErrorCode.SectionNotFound);
    expect(missingReorderFailure.code).toBe(GridgenErrorCode.ItemNotFound);
    expect(missingMoveItemFailure.code).toBe(GridgenErrorCode.ItemNotFound);
    expect(noOpReorder).toEqual(collection);
  });
});

function createBaseCollection(): DraftCollection {
  return unwrapOk(
    createCollectionDraft({
      title: "Music"
    })
  );
}

function createParsedCollection(): DraftCollection {
  return unwrapOk(
    parseDraftCollection({
      id: "music",
      schemaVersion: 1,
      sections: [
        {
          id: "section-1",
          items: [
            {
              description: "Optional short text.",
              id: "album-a",
              image: {
                alt: "Album A cover",
                crop: {
                  height: 100,
                  unit: "percent",
                  width: 100,
                  x: 0,
                  y: 0
                },
                sourceFileName: "album-a.jpg",
                type: "file"
              },
              link: "https://example.com/a",
              title: "Album A"
            }
          ],
          name: "S Tier"
        }
      ],
      title: "Music"
    })
  );
}

function firstSection(collection: DraftCollection): DraftCollection["sections"][number] {
  const section = collection.sections[0];

  if (section === undefined) {
    throw new Error("Expected first section.");
  }

  return section;
}

function secondSection(collection: DraftCollection): DraftCollection["sections"][number] {
  const section = collection.sections[1];

  if (section === undefined) {
    throw new Error("Expected second section.");
  }

  return section;
}

function firstItem(
  collection: DraftCollection
): DraftCollection["sections"][number]["items"][number] {
  const item = firstSection(collection).items[0];

  if (item === undefined) {
    throw new Error("Expected first item.");
  }

  return item;
}

function unwrapOk<Value, Failure>(result: Result<Value, Failure>): Value {
  if (isErr(result)) {
    throw new Error("Expected result to be ok.");
  }

  return result.value;
}

function unwrapErr<Value>(result: Result<Value, GridgenError>): GridgenError {
  if (isOk(result)) {
    throw new Error("Expected result to be an error.");
  }

  return result.error;
}
