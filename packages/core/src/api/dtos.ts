import type { DraftCollection, GridImage, ImageCrop } from "../collection/types";

/**
 * JSON-safe image reference used by server and browser API contracts.
 *
 * @property alt Optional alt text override.
 * @property crop Percentage crop metadata.
 * @property sourceFileName Safe source image file name text.
 * @property type Image reference discriminator.
 */
export interface GridImageJson {
  readonly alt?: string;
  readonly crop: ImageCrop;
  readonly sourceFileName: string;
  readonly type: "file";
}

/**
 * JSON-safe draft item used by server and browser API contracts.
 *
 * @property description Optional plain text description.
 * @property id Stable item ID text.
 * @property image Optional source image reference.
 * @property link Draft link href or an empty string.
 * @property title Draft item title.
 */
export interface DraftItemJson {
  readonly description?: string;
  readonly id: string;
  readonly image?: GridImageJson;
  readonly link: string;
  readonly title: string;
}

/**
 * JSON-safe draft section used by server and browser API contracts.
 *
 * @property id Stable section ID text.
 * @property items Ordered draft items.
 * @property name Draft section name.
 */
export interface DraftSectionJson {
  readonly id: string;
  readonly items: readonly DraftItemJson[];
  readonly name: string;
}

/**
 * JSON-safe draft collection used by server and browser API contracts.
 *
 * @property id Stable collection ID text.
 * @property schemaVersion Persisted schema version.
 * @property sections Ordered draft sections.
 * @property title Draft collection title.
 */
export interface DraftCollectionJson {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly sections: readonly DraftSectionJson[];
  readonly title: string;
}

/**
 * Collection summary returned by the local authoring API.
 *
 * @property id Stable collection ID text.
 * @property title Draft collection title.
 */
export interface CollectionSummaryDto {
  readonly id: string;
  readonly title: string;
}

/**
 * Response returned by `GET /api/collections`.
 *
 * @property collections Sorted collection summaries.
 */
export interface ListCollectionsResponseDto {
  readonly collections: readonly CollectionSummaryDto[];
}

/**
 * Request accepted by `POST /api/collections`.
 *
 * @property title Starting collection title.
 */
export interface CreateCollectionRequestDto {
  readonly title: string;
}

/**
 * Request accepted by `PUT /api/collections/:collectionId`.
 *
 * @property collection Complete draft collection snapshot to persist.
 */
export interface SaveCollectionRequestDto {
  readonly collection: DraftCollectionJson;
}

/**
 * Response returned by collection read, create, and save routes.
 *
 * @property collection Saved draft collection snapshot.
 */
export interface CollectionResponseDto {
  readonly collection: DraftCollectionJson;
}

/**
 * Response returned by collection validation routes.
 *
 * @property collectionId Stable collection ID text.
 * @property renderable Whether the draft is ready for preview/build.
 */
export interface ValidateCollectionResponseDto {
  readonly collectionId: string;
  readonly renderable: true;
}

/**
 * Response returned by source image upload routes.
 *
 * @property image Normalized source image reference with default crop metadata.
 */
export interface UploadAssetResponseDto {
  readonly image: GridImageJson;
}

/**
 * Serializes a parsed draft collection into stable JSON-safe API/persistence shape.
 *
 * @param collection Parsed draft collection.
 * @returns JSON-safe collection snapshot.
 */
export function serializeDraftCollection(collection: DraftCollection): DraftCollectionJson {
  return {
    id: collection.id.value,
    schemaVersion: collection.schemaVersion,
    sections: collection.sections.map((section) => ({
      id: section.id.value,
      items: section.items.map((item) => ({
        ...(item.description === undefined ? {} : { description: item.description }),
        ...(item.image === undefined ? {} : { image: serializeGridImage(item.image) }),
        id: item.id.value,
        link: serializeDraftLink(item.link),
        title: item.title
      })),
      name: section.name
    })),
    title: collection.title
  };
}

function serializeGridImage(image: GridImage): GridImageJson {
  return {
    ...(image.alt === undefined ? {} : { alt: image.alt }),
    crop: image.crop,
    sourceFileName: image.sourceFileName.value,
    type: image.type
  };
}

function serializeDraftLink(
  link: DraftCollection["sections"][number]["items"][number]["link"]
): string {
  switch (link.type) {
    case "absolute":
      return link.href;
    case "empty":
      return "";
    case "site":
      return link.href.value;
  }
}
