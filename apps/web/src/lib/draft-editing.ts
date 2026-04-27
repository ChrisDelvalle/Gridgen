import {
  CollectionOperationType,
  parseDraftCollection,
  parseDraftLink,
  parseImageCrop,
  parseSafeFileName,
  serializeDraftCollection,
  updateCollection,
  type DraftCollectionJson,
  type DraftItemJson,
  type GridImage,
  type GridImageJson,
  type GridgenError,
  type Result,
  type SerializedGridgenError
} from "@gridgen/core/browser";

/**
 * UI field validation message map keyed by collection field path.
 */
export type FieldErrors = ReadonlyMap<string, string>;

/**
 * Applies a title edit to a draft collection snapshot.
 *
 * @param collection Existing draft snapshot.
 * @param title New title text.
 * @returns Updated draft snapshot.
 */
export function setCollectionTitle(
  collection: DraftCollectionJson,
  title: string
): DraftCollectionJson {
  return {
    ...collection,
    title
  };
}

/**
 * Applies a section title edit through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @param sectionId Target section ID.
 * @param name New section name.
 * @returns Updated draft snapshot or structured failure.
 */
export function renameSection(
  collection: DraftCollectionJson,
  sectionId: string,
  name: string
): Result<DraftCollectionJson, GridgenError> {
  return applyOperation(collection, {
    name,
    sectionId: { value: sectionId },
    type: CollectionOperationType.RenameSection
  });
}

/**
 * Adds a new section through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @returns Updated draft snapshot or structured failure.
 */
export function addSection(
  collection: DraftCollectionJson
): Result<DraftCollectionJson, GridgenError> {
  return applyOperation(collection, {
    name: "New Section",
    type: CollectionOperationType.AddSection
  });
}

/**
 * Adds a draft item to a section through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @param sectionId Destination section ID.
 * @returns Updated draft snapshot or structured failure.
 */
export function addItem(
  collection: DraftCollectionJson,
  sectionId: string
): Result<DraftCollectionJson, GridgenError> {
  return applyOperation(collection, {
    sectionId: { value: sectionId },
    title: "",
    type: CollectionOperationType.AddItem
  });
}

/**
 * Removes a draft item through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @param itemId Target item ID.
 * @returns Updated draft snapshot or structured failure.
 */
export function removeItem(
  collection: DraftCollectionJson,
  itemId: string
): Result<DraftCollectionJson, GridgenError> {
  return applyOperation(collection, {
    itemId: { value: itemId },
    type: CollectionOperationType.RemoveItem
  });
}

/**
 * Removes a draft section through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @param sectionId Target section ID.
 * @returns Updated draft snapshot or structured failure.
 */
export function removeSection(
  collection: DraftCollectionJson,
  sectionId: string
): Result<DraftCollectionJson, GridgenError> {
  return applyOperation(collection, {
    sectionId: { value: sectionId },
    type: CollectionOperationType.RemoveSection
  });
}

/**
 * Updates a draft item through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @param item Updated item snapshot.
 * @returns Updated draft snapshot or structured failure.
 */
export function updateItem(
  collection: DraftCollectionJson,
  item: DraftItemJson
): Result<DraftCollectionJson, GridgenError> {
  const link = parseDraftLink(item.link, "item.link");

  if (!link.ok) {
    return link;
  }

  const image = item.image === undefined ? undefined : parseImage(item.image);

  if (image !== undefined && !image.ok) {
    return image;
  }

  return applyOperation(collection, {
    itemId: { value: item.id },
    patch: {
      description: item.description ?? null,
      image: image?.value ?? null,
      link: link.value,
      title: item.title
    },
    type: CollectionOperationType.UpdateItem
  });
}

/**
 * Moves a section through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @param sectionId Target section ID.
 * @param direction Relative movement direction.
 * @returns Updated draft snapshot or structured failure.
 */
export function moveSectionByDirection(
  collection: DraftCollectionJson,
  sectionId: string,
  direction: -1 | 1
): Result<DraftCollectionJson, GridgenError> {
  const currentIndex = collection.sections.findIndex((section) => section.id === sectionId);

  return applyOperation(collection, {
    sectionId: { value: sectionId },
    toIndex: currentIndex + direction,
    type: CollectionOperationType.ReorderSection
  });
}

/**
 * Moves a section to an absolute index through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @param sectionId Target section ID.
 * @param toIndex Destination index.
 * @returns Updated draft snapshot or structured failure.
 */
export function moveSection(
  collection: DraftCollectionJson,
  sectionId: string,
  toIndex: number
): Result<DraftCollectionJson, GridgenError> {
  return applyOperation(collection, {
    sectionId: { value: sectionId },
    toIndex,
    type: CollectionOperationType.ReorderSection
  });
}

/**
 * Moves an item through core collection operations.
 *
 * @param collection Existing draft snapshot.
 * @param itemId Target item ID.
 * @param toSectionId Destination section ID.
 * @param toIndex Destination index.
 * @returns Updated draft snapshot or structured failure.
 */
export function moveItem(
  collection: DraftCollectionJson,
  itemId: string,
  toSectionId: string,
  toIndex: number
): Result<DraftCollectionJson, GridgenError> {
  return applyOperation(collection, {
    itemId: { value: itemId },
    toIndex,
    toSectionId: { value: toSectionId },
    type: CollectionOperationType.MoveItem
  });
}

/**
 * Converts a serialized validation error into field errors.
 *
 * @param error Server/core validation error.
 * @returns Field error map.
 */
export function toFieldErrors(error: SerializedGridgenError | undefined): FieldErrors {
  if (error?.context.fieldPath === undefined) {
    return new Map();
  }

  return new Map([[error.context.fieldPath, error.message]]);
}

function applyOperation(
  collection: DraftCollectionJson,
  operation: Parameters<typeof updateCollection>[1]
): Result<DraftCollectionJson, GridgenError> {
  const parsed = parseDraftCollection(collection);

  if (!parsed.ok) {
    return parsed;
  }

  const updated = updateCollection(parsed.value, operation);

  if (!updated.ok) {
    return updated;
  }

  return {
    ok: true,
    value: serializeDraftCollection(updated.value)
  };
}

function parseImage(image: GridImageJson): Result<GridImage, GridgenError> {
  const sourceFileName = parseSafeFileName(image.sourceFileName, "item.image.sourceFileName");

  if (!sourceFileName.ok) {
    return sourceFileName;
  }

  const crop = parseImageCrop(image.crop, "item.image.crop");

  if (!crop.ok) {
    return crop;
  }

  return {
    ok: true,
    value: {
      ...(image.alt === undefined ? {} : { alt: image.alt }),
      crop: crop.value,
      sourceFileName: sourceFileName.value,
      type: "file"
    }
  };
}
