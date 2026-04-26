import {
  createOperationError,
  createValidationError,
  type GridgenError,
  GridgenErrorCode
} from "../errors/errors";
import { normalizeSlug } from "../paths/browser-paths";
import { err, ok, type Result } from "../result/result";
import type {
  CollectionId,
  DraftCollection,
  DraftItem,
  DraftItemPatch,
  DraftSection,
  ItemId,
  SectionId
} from "./types";

const starterSectionName = "Section 1";
const untitledSectionIdBase = "section";
const untitledItemIdBase = "item";

/**
 * Supported collection mutation operations.
 */
export enum CollectionOperationType {
  AddItem = "item.add",
  AddSection = "section.add",
  MoveItem = "item.move",
  RemoveItem = "item.remove",
  RemoveSection = "section.remove",
  ReorderItem = "item.reorder",
  ReorderSection = "section.reorder",
  RenameSection = "section.rename",
  UpdateItem = "item.update"
}

/**
 * Input used to create a new draft collection.
 *
 * @property reservedIds Existing collection IDs reserved by the caller.
 * @property title Collection title entered by the user.
 */
export interface CreateCollectionInput {
  readonly reservedIds?: readonly CollectionId[];
  readonly title: string;
}

/**
 * Adds a new draft section to the end of the collection.
 *
 * @property name Optional starting section name.
 * @property type Operation discriminator.
 */
export interface AddSectionOperation {
  readonly name?: string;
  readonly type: CollectionOperationType.AddSection;
}

/**
 * Renames an existing section without changing its stable ID.
 *
 * @property name New draft section name.
 * @property sectionId Target section ID.
 * @property type Operation discriminator.
 */
export interface RenameSectionOperation {
  readonly name: string;
  readonly sectionId: SectionId;
  readonly type: CollectionOperationType.RenameSection;
}

/**
 * Moves an existing section to a new index.
 *
 * @property sectionId Target section ID.
 * @property toIndex Requested destination index.
 * @property type Operation discriminator.
 */
export interface ReorderSectionOperation {
  readonly sectionId: SectionId;
  readonly toIndex: number;
  readonly type: CollectionOperationType.ReorderSection;
}

/**
 * Removes a section when another section still remains.
 *
 * @property sectionId Target section ID.
 * @property type Operation discriminator.
 */
export interface RemoveSectionOperation {
  readonly sectionId: SectionId;
  readonly type: CollectionOperationType.RemoveSection;
}

/**
 * Adds a new draft item to the end of a section.
 *
 * @property sectionId Destination section ID.
 * @property title Optional starting item title.
 * @property type Operation discriminator.
 */
export interface AddItemOperation {
  readonly sectionId: SectionId;
  readonly title?: string;
  readonly type: CollectionOperationType.AddItem;
}

/**
 * Updates an existing draft item in place while preserving its stable ID.
 *
 * @property itemId Target item ID.
 * @property patch Draft item patch.
 * @property type Operation discriminator.
 */
export interface UpdateItemOperation {
  readonly itemId: ItemId;
  readonly patch: DraftItemPatch;
  readonly type: CollectionOperationType.UpdateItem;
}

/**
 * Moves an item into another section or position.
 *
 * @property itemId Target item ID.
 * @property toIndex Requested destination index.
 * @property toSectionId Destination section ID.
 * @property type Operation discriminator.
 */
export interface MoveItemOperation {
  readonly itemId: ItemId;
  readonly toIndex: number;
  readonly toSectionId: SectionId;
  readonly type: CollectionOperationType.MoveItem;
}

/**
 * Reorders an item within its current section.
 *
 * @property itemId Target item ID.
 * @property toIndex Requested destination index.
 * @property type Operation discriminator.
 */
export interface ReorderItemOperation {
  readonly itemId: ItemId;
  readonly toIndex: number;
  readonly type: CollectionOperationType.ReorderItem;
}

/**
 * Removes an existing item from the collection.
 *
 * @property itemId Target item ID.
 * @property type Operation discriminator.
 */
export interface RemoveItemOperation {
  readonly itemId: ItemId;
  readonly type: CollectionOperationType.RemoveItem;
}

/**
 * Collection mutation operation union.
 */
export type CollectionOperation =
  | AddItemOperation
  | AddSectionOperation
  | MoveItemOperation
  | RemoveItemOperation
  | RemoveSectionOperation
  | ReorderItemOperation
  | ReorderSectionOperation
  | RenameSectionOperation
  | UpdateItemOperation;

/**
 * Creates a new draft collection with one starter section.
 *
 * @param input Collection creation input.
 * @returns New draft collection or a structured validation failure.
 */
export function createCollectionDraft(
  input: CreateCollectionInput
): Result<DraftCollection, GridgenError> {
  const title = input.title.trim();

  if (title.length === 0) {
    return err(
      createValidationError(
        GridgenErrorCode.CollectionEmptyTitle,
        "Collection title is required.",
        {
          fieldPath: "title"
        }
      )
    );
  }

  const normalizedSlug = normalizeSlug(title);

  if (!normalizedSlug.ok) {
    return normalizedSlug;
  }

  const collectionId = createCollectionId(normalizedSlug.value.value, input.reservedIds ?? []);
  const sectionId = createSectionId(starterSectionName, []);

  return ok({
    id: collectionId,
    schemaVersion: 1,
    sections: [
      {
        id: sectionId,
        items: [],
        name: starterSectionName
      }
    ],
    title
  });
}

/**
 * Applies one pure mutation to a draft collection.
 *
 * @param collection Draft collection to mutate.
 * @param operation Pure mutation operation.
 * @returns Updated draft collection or a structured operation failure.
 */
export function updateCollection(
  collection: DraftCollection,
  operation: CollectionOperation
): Result<DraftCollection, GridgenError> {
  switch (operation.type) {
    case CollectionOperationType.AddItem:
      return addItem(collection, operation);
    case CollectionOperationType.AddSection:
      return addSection(collection, operation);
    case CollectionOperationType.MoveItem:
      return moveItem(collection, operation);
    case CollectionOperationType.RemoveItem:
      return removeItem(collection, operation);
    case CollectionOperationType.RemoveSection:
      return removeSection(collection, operation);
    case CollectionOperationType.ReorderItem:
      return reorderItem(collection, operation);
    case CollectionOperationType.ReorderSection:
      return reorderSection(collection, operation);
    case CollectionOperationType.RenameSection:
      return renameSection(collection, operation);
    case CollectionOperationType.UpdateItem:
      return updateItem(collection, operation);
  }
}

function addSection(
  collection: DraftCollection,
  operation: AddSectionOperation
): Result<DraftCollection, GridgenError> {
  const name = operation.name ?? "";
  const nextSection: DraftSection = {
    id: createSectionId(name, collection.sections),
    items: [],
    name
  };

  return ok({
    ...collection,
    sections: [...collection.sections, nextSection]
  });
}

function renameSection(
  collection: DraftCollection,
  operation: RenameSectionOperation
): Result<DraftCollection, GridgenError> {
  const resolvedSection = resolveSection(collection.sections, operation.sectionId);

  if (!resolvedSection.ok) {
    return resolvedSection;
  }

  return ok({
    ...collection,
    sections: replaceAtIndex(collection.sections, resolvedSection.value.sectionIndex, {
      ...resolvedSection.value.section,
      name: operation.name
    })
  });
}

function reorderSection(
  collection: DraftCollection,
  operation: ReorderSectionOperation
): Result<DraftCollection, GridgenError> {
  const resolvedSection = resolveSection(collection.sections, operation.sectionId);

  if (!resolvedSection.ok) {
    return resolvedSection;
  }

  const toIndex = clampIndex(operation.toIndex, collection.sections.length);

  if (resolvedSection.value.sectionIndex === toIndex) {
    return ok(collection);
  }

  return ok({
    ...collection,
    sections: moveArrayItem(collection.sections, resolvedSection.value.sectionIndex, toIndex)
  });
}

function removeSection(
  collection: DraftCollection,
  operation: RemoveSectionOperation
): Result<DraftCollection, GridgenError> {
  const resolvedSection = resolveSection(collection.sections, operation.sectionId);

  if (!resolvedSection.ok) {
    return resolvedSection;
  }

  if (collection.sections.length === 1) {
    return err(
      createOperationError(
        GridgenErrorCode.SectionCannotRemoveLast,
        "Cannot remove the last remaining section.",
        {
          sectionId: operation.sectionId.value
        }
      )
    );
  }

  return ok({
    ...collection,
    sections: removeAtIndex(collection.sections, resolvedSection.value.sectionIndex)
  });
}

function addItem(
  collection: DraftCollection,
  operation: AddItemOperation
): Result<DraftCollection, GridgenError> {
  const resolvedSection = resolveSection(collection.sections, operation.sectionId);

  if (!resolvedSection.ok) {
    return resolvedSection;
  }

  const nextItem: DraftItem = {
    id: createItemId(operation.title ?? "", collection.sections),
    link: {
      type: "empty"
    },
    title: operation.title ?? ""
  };

  return ok({
    ...collection,
    sections: replaceAtIndex(collection.sections, resolvedSection.value.sectionIndex, {
      ...resolvedSection.value.section,
      items: [...resolvedSection.value.section.items, nextItem]
    })
  });
}

function updateItem(
  collection: DraftCollection,
  operation: UpdateItemOperation
): Result<DraftCollection, GridgenError> {
  const resolvedItem = resolveItem(collection.sections, operation.itemId);

  if (!resolvedItem.ok) {
    return resolvedItem;
  }

  const nextItem = applyItemPatch(resolvedItem.value.item, operation.patch);
  const nextSection = {
    ...resolvedItem.value.section,
    items: replaceAtIndex(resolvedItem.value.section.items, resolvedItem.value.itemIndex, nextItem)
  };

  return ok({
    ...collection,
    sections: replaceAtIndex(collection.sections, resolvedItem.value.sectionIndex, nextSection)
  });
}

function moveItem(
  collection: DraftCollection,
  operation: MoveItemOperation
): Result<DraftCollection, GridgenError> {
  const resolvedItem = resolveItem(collection.sections, operation.itemId);

  if (!resolvedItem.ok) {
    return resolvedItem;
  }

  const resolvedDestination = resolveSection(collection.sections, operation.toSectionId);

  if (!resolvedDestination.ok) {
    return resolvedDestination;
  }

  if (resolvedItem.value.sectionIndex === resolvedDestination.value.sectionIndex) {
    return reorderItem(collection, {
      itemId: operation.itemId,
      toIndex: operation.toIndex,
      type: CollectionOperationType.ReorderItem
    });
  }

  const nextSourceSection: DraftSection = {
    ...resolvedItem.value.section,
    items: removeAtIndex(resolvedItem.value.section.items, resolvedItem.value.itemIndex)
  };
  const insertionIndex = clampInsertIndex(
    operation.toIndex,
    resolvedDestination.value.section.items.length
  );
  const nextDestinationSection: DraftSection = {
    ...resolvedDestination.value.section,
    items: insertAtIndex(
      resolvedDestination.value.section.items,
      insertionIndex,
      resolvedItem.value.item
    )
  };
  const nextSections = replaceAtIndex(
    collection.sections,
    resolvedItem.value.sectionIndex,
    nextSourceSection
  );

  return ok({
    ...collection,
    sections: replaceAtIndex(
      nextSections,
      resolvedDestination.value.sectionIndex,
      nextDestinationSection
    )
  });
}

function reorderItem(
  collection: DraftCollection,
  operation: ReorderItemOperation
): Result<DraftCollection, GridgenError> {
  const resolvedItem = resolveItem(collection.sections, operation.itemId);

  if (!resolvedItem.ok) {
    return resolvedItem;
  }

  const toIndex = clampIndex(operation.toIndex, resolvedItem.value.section.items.length);

  if (resolvedItem.value.itemIndex === toIndex) {
    return ok(collection);
  }

  return ok({
    ...collection,
    sections: replaceAtIndex(collection.sections, resolvedItem.value.sectionIndex, {
      ...resolvedItem.value.section,
      items: moveArrayItem(resolvedItem.value.section.items, resolvedItem.value.itemIndex, toIndex)
    })
  });
}

function removeItem(
  collection: DraftCollection,
  operation: RemoveItemOperation
): Result<DraftCollection, GridgenError> {
  const resolvedItem = resolveItem(collection.sections, operation.itemId);

  if (!resolvedItem.ok) {
    return resolvedItem;
  }

  return ok({
    ...collection,
    sections: replaceAtIndex(collection.sections, resolvedItem.value.sectionIndex, {
      ...resolvedItem.value.section,
      items: removeAtIndex(resolvedItem.value.section.items, resolvedItem.value.itemIndex)
    })
  });
}

function applyItemPatch(item: DraftItem, patch: DraftItemPatch): DraftItem {
  let description = item.description;

  if (patch.description !== undefined) {
    description = patch.description ?? undefined;
  }

  let image = item.image;

  if (patch.image !== undefined) {
    image = patch.image ?? undefined;
  }

  return {
    ...(description === undefined ? {} : { description }),
    ...(image === undefined ? {} : { image }),
    id: item.id,
    link: patch.link ?? item.link,
    title: patch.title ?? item.title
  };
}

function createCollectionId(baseText: string, reservedIds: readonly CollectionId[]): CollectionId {
  return {
    value: createUniqueIdentifier(
      baseText,
      new Set(reservedIds.map((collectionId) => collectionId.value))
    )
  };
}

function createSectionId(baseText: string, sections: readonly DraftSection[]): SectionId {
  return {
    value: createUniqueIdentifier(
      getIdentifierBase(baseText, untitledSectionIdBase),
      new Set(sections.map((section) => section.id.value))
    )
  };
}

function createItemId(baseText: string, sections: readonly DraftSection[]): ItemId {
  return {
    value: createUniqueIdentifier(
      getIdentifierBase(baseText, untitledItemIdBase),
      new Set(sections.flatMap((section) => section.items.map((item) => item.id.value)))
    )
  };
}

function createUniqueIdentifier(baseText: string, existingIds: ReadonlySet<string>): string {
  let candidate = baseText;
  let suffix = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseText}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function getIdentifierBase(input: string, fallback: string): string {
  const slug = normalizeSlug(input);

  return slug.ok ? slug.value.value : fallback;
}

function findItemLocation(
  sections: readonly DraftSection[],
  itemId: ItemId
):
  | {
      readonly item: DraftItem;
      readonly itemIndex: number;
      readonly section: DraftSection;
      readonly sectionIndex: number;
    }
  | undefined {
  for (const [sectionIndex, section] of sections.entries()) {
    for (const [itemIndex, item] of section.items.entries()) {
      if (item.id.value !== itemId.value) {
        continue;
      }

      return {
        item,
        itemIndex,
        section,
        sectionIndex
      };
    }
  }

  return undefined;
}

function resolveSection(
  sections: readonly DraftSection[],
  sectionId: SectionId
): Result<{ readonly section: DraftSection; readonly sectionIndex: number }, GridgenError> {
  for (const [sectionIndex, section] of sections.entries()) {
    if (section.id.value !== sectionId.value) {
      continue;
    }

    return ok({
      section,
      sectionIndex
    });
  }

  return sectionNotFound(sectionId);
}

function resolveItem(
  sections: readonly DraftSection[],
  itemId: ItemId
): Result<
  {
    readonly item: DraftItem;
    readonly itemIndex: number;
    readonly section: DraftSection;
    readonly sectionIndex: number;
  },
  GridgenError
> {
  const itemLocation = findItemLocation(sections, itemId);

  if (itemLocation === undefined) {
    return itemNotFound(itemId);
  }

  return ok({
    item: itemLocation.item,
    itemIndex: itemLocation.itemIndex,
    section: itemLocation.section,
    sectionIndex: itemLocation.sectionIndex
  });
}

function sectionNotFound(sectionId: SectionId): Result<never, GridgenError> {
  return err(
    createOperationError(GridgenErrorCode.SectionNotFound, "Section was not found.", {
      sectionId: sectionId.value
    })
  );
}

function itemNotFound(itemId: ItemId): Result<never, GridgenError> {
  return err(
    createOperationError(GridgenErrorCode.ItemNotFound, "Item was not found.", {
      itemId: itemId.value
    })
  );
}

function clampIndex(index: number, length: number): number {
  const maxIndex = Math.max(length - 1, 0);

  return Math.min(Math.max(Math.trunc(index), 0), maxIndex);
}

function clampInsertIndex(index: number, length: number): number {
  return Math.min(Math.max(Math.trunc(index), 0), length);
}

function moveArrayItem<Value>(
  values: readonly Value[],
  fromIndex: number,
  toIndex: number
): readonly Value[] {
  const nextValues = [...values];
  nextValues.splice(toIndex, 0, ...nextValues.splice(fromIndex, 1));

  return nextValues;
}

function replaceAtIndex<Value>(
  values: readonly Value[],
  index: number,
  nextValue: Value
): readonly Value[] {
  const nextValues = [...values];
  nextValues[index] = nextValue;

  return nextValues;
}

function removeAtIndex<Value>(values: readonly Value[], index: number): readonly Value[] {
  return values.filter((_, currentIndex) => currentIndex !== index);
}

function insertAtIndex<Value>(
  values: readonly Value[],
  index: number,
  nextValue: Value
): readonly Value[] {
  const nextValues = [...values];
  nextValues.splice(index, 0, nextValue);

  return nextValues;
}
