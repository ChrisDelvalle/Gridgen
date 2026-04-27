/**
 * Slug-safe collection identifier.
 *
 * @property value Normalized identifier text.
 */
export interface CollectionId {
  readonly value: string;
}

/**
 * Slug-safe section identifier.
 *
 * @property value Normalized identifier text.
 */
export interface SectionId {
  readonly value: string;
}

/**
 * Slug-safe item identifier.
 *
 * @property value Normalized identifier text.
 */
export interface ItemId {
  readonly value: string;
}

/**
 * Slug value safe for generated IDs and path segments.
 *
 * @property value Normalized slug text.
 */
export interface Slug {
  readonly value: string;
}

/**
 * File name that cannot traverse directories.
 *
 * @property value Safe file name text.
 */
export interface SafeFileName {
  readonly value: string;
}

/**
 * Site-local link that cannot execute script or traverse paths.
 *
 * @property value Safe local href text.
 */
export interface SafeLocalLink {
  readonly value: string;
}

/**
 * Text known to contain non-whitespace content.
 *
 * @property value Trimmed text content.
 */
export interface NonEmptyText {
  readonly value: string;
}

/**
 * Absolute HTTP or HTTPS link.
 *
 * @property href Fully qualified URL.
 * @property type Link discriminator.
 */
export interface AbsoluteLink {
  readonly href: string;
  readonly type: "absolute";
}

/**
 * Safe site-local link.
 *
 * @property href Local href.
 * @property type Link discriminator.
 */
export interface SiteLink {
  readonly href: SafeLocalLink;
  readonly type: "site";
}

/**
 * Empty authoring-state link.
 *
 * @property type Link discriminator.
 */
export interface EmptyLink {
  readonly type: "empty";
}

/**
 * Link that is valid for rendering.
 */
export type GridLink = AbsoluteLink | SiteLink;

/**
 * Link accepted in draft authoring state.
 */
export type DraftLink = EmptyLink | GridLink;

/**
 * Percentage image crop rectangle.
 *
 * @property height Rectangle height percentage.
 * @property unit Crop coordinate unit.
 * @property width Rectangle width percentage.
 * @property x Left coordinate percentage.
 * @property y Top coordinate percentage.
 */
export interface ImageCrop {
  readonly height: number;
  readonly unit: "percent";
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Source image reference owned by the Gridgen source workspace.
 *
 * @property alt Optional alt text override.
 * @property crop Percentage crop metadata.
 * @property sourceFileName Safe source image file name.
 * @property type Image reference discriminator.
 */
export interface GridImage {
  readonly alt?: string;
  readonly crop: ImageCrop;
  readonly sourceFileName: SafeFileName;
  readonly type: "file";
}

/**
 * Draft item persisted by the authoring tool.
 *
 * @property description Optional plain text description.
 * @property id Stable item ID.
 * @property image Optional source image reference.
 * @property link Draft link value.
 * @property title Item title draft text.
 */
export interface DraftItem {
  readonly description?: string;
  readonly id: ItemId;
  readonly image?: GridImage;
  readonly link: DraftLink;
  readonly title: string;
}

/**
 * Patch applied to a draft item.
 *
 * @property description New description, or `null` to clear it.
 * @property image New image, or `null` to clear it.
 * @property link New draft link value.
 * @property title New draft title.
 */
export interface DraftItemPatch {
  readonly description?: string | null;
  readonly image?: GridImage | null;
  readonly link?: DraftLink;
  readonly title?: string;
}

/**
 * Renderable recommendation item.
 *
 * @property description Optional non-empty description.
 * @property id Stable item ID.
 * @property image Optional source image reference.
 * @property link Optional renderable link.
 * @property title Optional non-empty item title.
 */
export interface RenderableItem {
  readonly description?: NonEmptyText;
  readonly id: ItemId;
  readonly image?: GridImage;
  readonly link?: GridLink;
  readonly title?: NonEmptyText;
}

/**
 * Draft section persisted by the authoring tool.
 *
 * @property id Stable section ID.
 * @property items Ordered draft items.
 * @property name Section name draft text.
 */
export interface DraftSection {
  readonly id: SectionId;
  readonly items: readonly DraftItem[];
  readonly name: string;
}

/**
 * Renderable section.
 *
 * @property id Stable section ID.
 * @property items Ordered renderable items.
 * @property name Non-empty section name.
 */
export interface RenderableSection {
  readonly id: SectionId;
  readonly items: readonly RenderableItem[];
  readonly name: NonEmptyText;
}

/**
 * Draft collection persisted by the authoring tool.
 *
 * @property id Stable collection ID.
 * @property schemaVersion Persisted schema version.
 * @property sections Ordered draft sections.
 * @property title Collection title draft text.
 */
export interface DraftCollection {
  readonly id: CollectionId;
  readonly schemaVersion: 1;
  readonly sections: readonly DraftSection[];
  readonly title: string;
}

/**
 * Collection that satisfies preview/build requirements.
 *
 * @property id Stable collection ID.
 * @property schemaVersion Persisted schema version.
 * @property sections Ordered renderable sections.
 * @property title Non-empty collection title.
 */
export interface RenderableCollection {
  readonly id: CollectionId;
  readonly schemaVersion: 1;
  readonly sections: readonly RenderableSection[];
  readonly title: NonEmptyText;
}
