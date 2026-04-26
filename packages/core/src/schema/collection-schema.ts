import { z } from "zod";

import type {
  CollectionId,
  DraftCollection,
  DraftItem,
  DraftLink,
  DraftSection,
  GridImage,
  GridLink,
  ImageCrop,
  ItemId,
  NonEmptyText,
  RenderableCollection,
  RenderableItem,
  RenderableSection,
  SectionId
} from "../collection/types";
import {
  createAssetError,
  createValidationError,
  type GridgenError,
  GridgenErrorCode
} from "../errors/errors";
import { parseDraftLink, parseSafeFileName, parseSlug } from "../paths/browser-paths";
import { err, ok, type Result } from "../result/result";

const currentSchemaVersion = 1;
const rawCropSchema = z
  .object({
    height: z.number(),
    unit: z.literal("percent"),
    width: z.number(),
    x: z.number(),
    y: z.number()
  })
  .strict();

const rawImageSchema = z
  .object({
    alt: z.string().optional(),
    crop: rawCropSchema,
    sourceFileName: z.string(),
    type: z.literal("file")
  })
  .strict();

const rawItemSchema = z
  .object({
    description: z.string().optional(),
    id: z.string(),
    image: rawImageSchema.optional(),
    link: z.string(),
    title: z.string()
  })
  .strict();

const rawSectionSchema = z
  .object({
    id: z.string(),
    items: z.array(rawItemSchema),
    name: z.string()
  })
  .strict();

const rawCollectionV1Schema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(currentSchemaVersion),
    sections: z.array(rawSectionSchema),
    title: z.string()
  })
  .strict();

const rawSchemaVersionSchema = z.looseObject({
  schemaVersion: z.number()
});

type RawCollectionV1 = z.infer<typeof rawCollectionV1Schema>;
type RawImage = z.infer<typeof rawImageSchema>;
type RawItem = z.infer<typeof rawItemSchema>;
type RawSection = z.infer<typeof rawSectionSchema>;

/**
 * Parses an unknown JSON-like value into a draft collection.
 *
 * @param input Unknown boundary input.
 * @returns Parsed draft collection or a structured parse failure.
 */
export function parseDraftCollection(input: unknown): Result<DraftCollection, GridgenError> {
  const rawCollection = parseVersionedCollection(input);

  if (!rawCollection.ok) {
    return rawCollection;
  }

  return mapRawCollection(rawCollection.value);
}

/**
 * Converts a draft collection into a renderable collection.
 *
 * @param collection Draft collection to validate.
 * @returns Renderable collection or a structured readiness failure.
 */
export function toRenderableCollection(
  collection: DraftCollection
): Result<RenderableCollection, GridgenError> {
  const title = parseNonEmptyText(collection.title, GridgenErrorCode.CollectionEmptyTitle, "title");

  if (!title.ok) {
    return title;
  }

  const sections = mapRenderableSections(collection);

  if (!sections.ok) {
    return sections;
  }

  return ok({
    id: collection.id,
    schemaVersion: currentSchemaVersion,
    sections: sections.value,
    title: title.value
  });
}

/**
 * Parses an unknown JSON-like value directly into a renderable collection.
 *
 * @param input Unknown boundary input.
 * @returns Parsed renderable collection or a structured parse failure.
 */
export function parseRenderableCollection(
  input: unknown
): Result<RenderableCollection, GridgenError> {
  const draft = parseDraftCollection(input);

  if (!draft.ok) {
    return draft;
  }

  return toRenderableCollection(draft.value);
}

/**
 * Parses slug-safe collection ID text.
 *
 * @param input Candidate collection ID.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Collection ID or a structured validation failure.
 */
export function parseCollectionId(
  input: string,
  fieldPath = "id"
): Result<CollectionId, GridgenError> {
  const slug = parseSlug(input, fieldPath);

  if (!slug.ok) {
    return slug;
  }

  return ok({ value: slug.value.value });
}

/**
 * Parses slug-safe section ID text.
 *
 * @param input Candidate section ID.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Section ID or a structured validation failure.
 */
export function parseSectionId(input: string, fieldPath = "id"): Result<SectionId, GridgenError> {
  const slug = parseSlug(input, fieldPath);

  if (!slug.ok) {
    return slug;
  }

  return ok({ value: slug.value.value });
}

/**
 * Parses slug-safe item ID text.
 *
 * @param input Candidate item ID.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Item ID or a structured validation failure.
 */
export function parseItemId(input: string, fieldPath = "id"): Result<ItemId, GridgenError> {
  const slug = parseSlug(input, fieldPath);

  if (!slug.ok) {
    return slug;
  }

  return ok({ value: slug.value.value });
}

/**
 * Parses crop metadata.
 *
 * @param input Candidate crop metadata.
 * @param fieldPath Logical field path for diagnostics.
 * @returns Image crop or a structured validation failure.
 */
export function parseImageCrop(
  input: ImageCrop,
  fieldPath = "image.crop"
): Result<ImageCrop, GridgenError> {
  if (!isValidCrop(input)) {
    return err(
      createAssetError(GridgenErrorCode.AssetInvalidCrop, "Expected a valid percentage crop.", {
        fieldPath
      })
    );
  }

  return ok(input);
}

function parseVersionedCollection(input: unknown): Result<RawCollectionV1, GridgenError> {
  const versionResult = rawSchemaVersionSchema.safeParse(input);

  if (!versionResult.success) {
    return err(
      createValidationError(
        GridgenErrorCode.CollectionInvalidJson,
        "Expected a collection schema version.",
        {
          fieldPath: firstIssuePath(versionResult.error)
        }
      )
    );
  }

  if (versionResult.data.schemaVersion !== currentSchemaVersion) {
    return err(
      createValidationError(
        GridgenErrorCode.CollectionUnsupportedSchemaVersion,
        "Unsupported collection schema version.",
        {
          fieldPath: "schemaVersion"
        }
      )
    );
  }

  return parseCurrentVersion(input);
}

function parseCurrentVersion(input: unknown): Result<RawCollectionV1, GridgenError> {
  const collectionResult = rawCollectionV1Schema.safeParse(input);

  if (!collectionResult.success) {
    return err(
      createValidationError(GridgenErrorCode.CollectionInvalidJson, "Invalid collection shape.", {
        fieldPath: firstIssuePath(collectionResult.error)
      })
    );
  }

  return ok(collectionResult.data);
}

function mapRawCollection(rawCollection: RawCollectionV1): Result<DraftCollection, GridgenError> {
  const id = parseCollectionId(rawCollection.id, "id");

  if (!id.ok) {
    return id;
  }

  const sections = mapRawSections(rawCollection.sections);

  if (!sections.ok) {
    return sections;
  }

  return ok({
    id: id.value,
    schemaVersion: currentSchemaVersion,
    sections: sections.value,
    title: rawCollection.title
  });
}

function mapRawSections(
  rawSections: readonly RawSection[]
): Result<readonly DraftSection[], GridgenError> {
  const sectionIds = new Set<string>();
  const itemIds = new Set<string>();
  const sections: DraftSection[] = [];

  for (const [sectionIndex, rawSection] of rawSections.entries()) {
    const section = mapRawSection(rawSection, sectionIndex, itemIds);

    if (!section.ok) {
      return section;
    }

    if (sectionIds.has(section.value.id.value)) {
      return err(
        createValidationError(GridgenErrorCode.CollectionDuplicateId, "Duplicate section ID.", {
          fieldPath: `sections.${sectionIndex}.id`,
          sectionId: section.value.id.value
        })
      );
    }

    sectionIds.add(section.value.id.value);
    sections.push(section.value);
  }

  return ok(sections);
}

function mapRawSection(
  rawSection: RawSection,
  sectionIndex: number,
  itemIds: Set<string>
): Result<DraftSection, GridgenError> {
  const id = parseSectionId(rawSection.id, `sections.${sectionIndex}.id`);

  if (!id.ok) {
    return id;
  }

  const items = mapRawItems(rawSection.items, sectionIndex, itemIds);

  if (!items.ok) {
    return items;
  }

  return ok({
    id: id.value,
    items: items.value,
    name: rawSection.name
  });
}

function mapRawItems(
  rawItems: readonly RawItem[],
  sectionIndex: number,
  itemIds: Set<string>
): Result<readonly DraftItem[], GridgenError> {
  const items: DraftItem[] = [];

  for (const [itemIndex, rawItem] of rawItems.entries()) {
    const item = mapRawItem(rawItem, sectionIndex, itemIndex);

    if (!item.ok) {
      return item;
    }

    if (itemIds.has(item.value.id.value)) {
      return err(
        createValidationError(GridgenErrorCode.CollectionDuplicateId, "Duplicate item ID.", {
          fieldPath: `sections.${sectionIndex}.items.${itemIndex}.id`,
          itemId: item.value.id.value
        })
      );
    }

    itemIds.add(item.value.id.value);
    items.push(item.value);
  }

  return ok(items);
}

function mapRawItem(
  rawItem: RawItem,
  sectionIndex: number,
  itemIndex: number
): Result<DraftItem, GridgenError> {
  const fieldPath = `sections.${sectionIndex}.items.${itemIndex}`;
  const id = parseItemId(rawItem.id, `${fieldPath}.id`);

  if (!id.ok) {
    return id;
  }

  const link = parseDraftLink(rawItem.link, `${fieldPath}.link`);

  if (!link.ok) {
    return link;
  }

  const image = mapOptionalImage(rawItem.image, `${fieldPath}.image`);

  if (!image.ok) {
    return image;
  }

  return ok(buildDraftItem(rawItem, id.value, link.value, image.value));
}

function buildDraftItem(
  rawItem: RawItem,
  id: ItemId,
  link: DraftLink,
  image: GridImage | undefined
): DraftItem {
  return {
    ...(rawItem.description === undefined ? {} : { description: rawItem.description }),
    ...(image === undefined ? {} : { image }),
    id,
    link,
    title: rawItem.title
  };
}

function mapOptionalImage(
  rawImage: RawImage | undefined,
  fieldPath: string
): Result<GridImage | undefined, GridgenError> {
  if (rawImage === undefined) {
    return ok(undefined);
  }

  return mapRawImage(rawImage, fieldPath);
}

function mapRawImage(rawImage: RawImage, fieldPath: string): Result<GridImage, GridgenError> {
  const sourceFileName = parseSafeFileName(rawImage.sourceFileName, `${fieldPath}.sourceFileName`);

  if (!sourceFileName.ok) {
    return sourceFileName;
  }

  const crop = parseImageCrop(rawImage.crop, `${fieldPath}.crop`);

  if (!crop.ok) {
    return crop;
  }

  return ok({
    ...(rawImage.alt === undefined ? {} : { alt: rawImage.alt }),
    crop: crop.value,
    sourceFileName: sourceFileName.value,
    type: "file"
  });
}

function mapRenderableSections(
  collection: DraftCollection
): Result<readonly RenderableSection[], GridgenError> {
  const sections: RenderableSection[] = [];

  for (const [sectionIndex, section] of collection.sections.entries()) {
    const renderableSection = mapRenderableSection(section, sectionIndex);

    if (!renderableSection.ok) {
      return renderableSection;
    }

    sections.push(renderableSection.value);
  }

  return ok(sections);
}

function mapRenderableSection(
  section: DraftSection,
  sectionIndex: number
): Result<RenderableSection, GridgenError> {
  const name = parseNonEmptyText(
    section.name,
    GridgenErrorCode.SectionEmptyName,
    `sections.${sectionIndex}.name`
  );

  if (!name.ok) {
    return name;
  }

  const items = mapRenderableItems(section.items, sectionIndex);

  if (!items.ok) {
    return items;
  }

  return ok({
    id: section.id,
    items: items.value,
    name: name.value
  });
}

function mapRenderableItems(
  items: readonly DraftItem[],
  sectionIndex: number
): Result<readonly RenderableItem[], GridgenError> {
  const renderableItems: RenderableItem[] = [];

  for (const [itemIndex, item] of items.entries()) {
    const renderableItem = mapRenderableItem(item, sectionIndex, itemIndex);

    if (!renderableItem.ok) {
      return renderableItem;
    }

    renderableItems.push(renderableItem.value);
  }

  return ok(renderableItems);
}

function mapRenderableItem(
  item: DraftItem,
  sectionIndex: number,
  itemIndex: number
): Result<RenderableItem, GridgenError> {
  const fieldPath = `sections.${sectionIndex}.items.${itemIndex}`;
  const title = parseNonEmptyText(
    item.title,
    GridgenErrorCode.ItemEmptyTitle,
    `${fieldPath}.title`
  );

  if (!title.ok) {
    return title;
  }

  const link = requireRenderableLink(item.link, `${fieldPath}.link`);

  if (!link.ok) {
    return link;
  }

  if (item.image === undefined) {
    return err(
      createValidationError(GridgenErrorCode.ItemMissingImage, "Item image is required.", {
        fieldPath: `${fieldPath}.image`,
        itemId: item.id.value
      })
    );
  }

  return ok(buildRenderableItem(item, title.value, link.value, item.image));
}

function buildRenderableItem(
  item: DraftItem,
  title: NonEmptyText,
  link: GridLink,
  image: GridImage
): RenderableItem {
  const description = parseOptionalDescription(item.description);

  return {
    ...(description === undefined ? {} : { description }),
    id: item.id,
    image,
    link,
    title
  };
}

function parseOptionalDescription(description: string | undefined): NonEmptyText | undefined {
  if (description === undefined) {
    return undefined;
  }

  const trimmed = description.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  return { value: trimmed };
}

function requireRenderableLink(link: DraftLink, fieldPath: string): Result<GridLink, GridgenError> {
  if (link.type === "empty") {
    return err(
      createValidationError(GridgenErrorCode.ItemInvalidLink, "Item link is required.", {
        fieldPath
      })
    );
  }

  return ok(link);
}

function parseNonEmptyText(
  input: string,
  code:
    | GridgenErrorCode.CollectionEmptyTitle
    | GridgenErrorCode.ItemEmptyTitle
    | GridgenErrorCode.SectionEmptyName,
  fieldPath: string
): Result<NonEmptyText, GridgenError> {
  const value = input.trim();

  if (value.length === 0) {
    return err(
      createValidationError(code, "Expected non-empty text.", {
        fieldPath
      })
    );
  }

  return ok({ value });
}

function isValidCrop(crop: ImageCrop): boolean {
  return (
    Number.isFinite(crop.x) &&
    Number.isFinite(crop.y) &&
    Number.isFinite(crop.width) &&
    Number.isFinite(crop.height) &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.width > 0 &&
    crop.height > 0 &&
    crop.x + crop.width <= 100 &&
    crop.y + crop.height <= 100
  );
}

function firstIssuePath(error: z.ZodError): string {
  return error.issues[0]?.path.map(String).join(".") ?? "";
}
