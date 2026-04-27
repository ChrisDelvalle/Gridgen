import * as path from "node:path";

import type {
  CollectionId,
  ImageCrop,
  ItemId,
  RenderableCollection,
  SafeFileName
} from "../collection/types";
import type { GridgenError } from "../errors/errors";
import {
  type JekyllOutputPaths,
  planJekyllOutputPaths,
  type PlannedPath
} from "../paths/path-planning";
import {
  createJekyllAssetUrlExpression,
  type GridRenderLayout,
  type JekyllAssetUrlExpression,
  renderGridCss,
  renderGridHtml,
  type RenderGridItem,
  type RenderGridSection
} from "../render/grid-renderer";
import { ok, type Result } from "../result/result";

/**
 * Planned generated text file.
 *
 * @property contents Generated file contents.
 * @property outputPath Planned output path.
 */
export interface PlannedTextOutput {
  readonly contents: string;
  readonly outputPath: PlannedPath;
}

/**
 * Planned generated image output.
 *
 * @property crop Persisted crop metadata for the source image.
 * @property itemId Stable item ID.
 * @property outputPath Planned generated image path.
 * @property outputUrl Liquid-safe generated asset URL for rendering.
 * @property sourceFileName Stored source image file name.
 */
export interface PlannedImageOutput {
  readonly crop: ImageCrop;
  readonly itemId: ItemId;
  readonly outputPath: PlannedPath;
  readonly outputUrl: JekyllAssetUrlExpression;
  readonly sourceFileName: SafeFileName;
}

/**
 * Input used to plan a Jekyll build for one renderable collection.
 *
 * @property collection Renderable source collection.
 * @property jekyllRoot Absolute Jekyll site root path.
 * @property layout Optional static presentation layout.
 */
export interface JekyllBuildInput {
  readonly collection: RenderableCollection;
  readonly jekyllRoot: string;
  readonly layout?: GridRenderLayout;
}

/**
 * Deterministic build manifest for one renderable collection.
 *
 * @property cleanupDirectory Gridgen-owned collection asset directory eligible for stale cleanup.
 * @property collectionId Stable collection ID.
 * @property cssOutput Shared stylesheet output.
 * @property htmlOutput Collection include output.
 * @property imageOutputs Deterministic generated image outputs.
 * @property paths Planned owned Jekyll paths for this collection.
 */
export interface JekyllBuildPlan {
  readonly cleanupDirectory: PlannedPath;
  readonly collectionId: CollectionId;
  readonly cssOutput: PlannedTextOutput;
  readonly htmlOutput: PlannedTextOutput;
  readonly imageOutputs: readonly PlannedImageOutput[];
  readonly paths: JekyllOutputPaths;
}

type RenderableSectionInput = RenderableCollection["sections"][number];
type RenderableItemInput = RenderableSectionInput["items"][number];

/**
 * Plans all Jekyll outputs for one renderable collection without touching the filesystem.
 *
 * @param input Build planning input.
 * @returns Deterministic build manifest or a structured failure.
 */
export function planJekyllBuild(input: JekyllBuildInput): Result<JekyllBuildPlan, GridgenError> {
  const paths = planJekyllOutputPaths({
    collectionId: input.collection.id,
    jekyllRoot: input.jekyllRoot
  });

  if (!paths.ok) {
    return paths;
  }

  const plannedAssets = planCollectionAssets(
    paths.value.collectionAssetDirectory,
    input.collection
  );
  const stylesheetHref = createJekyllAssetUrlExpression({
    value: "/assets/gridgen/gridgen.css"
  });

  return ok({
    cleanupDirectory: paths.value.collectionAssetDirectory,
    collectionId: input.collection.id,
    cssOutput: {
      contents: renderGridCss(),
      outputPath: paths.value.sharedStylesheetFile
    },
    htmlOutput: {
      contents: renderGridHtml({
        collectionId: input.collection.id,
        layout: input.layout ?? "classic",
        sections: plannedAssets.renderSections,
        stylesheetHref,
        title: input.collection.title
      }),
      outputPath: paths.value.collectionIncludeFile
    },
    imageOutputs: plannedAssets.imageOutputs,
    paths: paths.value
  });
}

function planCollectionAssets(
  collectionAssetDirectory: PlannedPath,
  collection: RenderableCollection
): {
  readonly imageOutputs: readonly PlannedImageOutput[];
  readonly renderSections: readonly RenderGridSection[];
} {
  const imageOutputs: PlannedImageOutput[] = [];
  const renderSections = collection.sections.map((section) => {
    const sectionPlan = planSectionAssets(collectionAssetDirectory, section);

    imageOutputs.push(...sectionPlan.imageOutputs);

    return sectionPlan.renderSection;
  });

  return {
    imageOutputs,
    renderSections
  };
}

function planSectionAssets(
  collectionAssetDirectory: PlannedPath,
  section: RenderableSectionInput
): {
  readonly imageOutputs: readonly PlannedImageOutput[];
  readonly renderSection: RenderGridSection;
} {
  const imageOutputs: PlannedImageOutput[] = [];
  const renderItems = section.items.map((item) => {
    const itemPlan = planItemAssets(collectionAssetDirectory, item);

    if (itemPlan.imageOutput !== undefined) {
      imageOutputs.push(itemPlan.imageOutput);
    }

    return itemPlan.renderItem;
  });

  return {
    imageOutputs,
    renderSection: {
      id: section.id,
      items: renderItems,
      name: section.name
    }
  };
}

function planItemAssets(
  collectionAssetDirectory: PlannedPath,
  item: RenderableItemInput
): {
  readonly imageOutput?: PlannedImageOutput;
  readonly renderItem: RenderGridItem;
} {
  const plannedImage = planOptionalItemImage(collectionAssetDirectory, item);

  return {
    ...(plannedImage === undefined ? {} : { imageOutput: plannedImage.imageOutput }),
    renderItem: buildRenderItem(item, plannedImage?.outputUrl)
  };
}

function buildRenderItem(
  item: RenderableItemInput,
  outputUrl: JekyllAssetUrlExpression | undefined
): RenderGridItem {
  return {
    ...(item.description === undefined ? {} : { description: item.description }),
    ...(item.image === undefined || outputUrl === undefined
      ? {}
      : {
          image: {
            alt: resolveImageAltText(item),
            src: outputUrl
          }
        }),
    ...(item.link === undefined ? {} : { link: item.link }),
    ...(item.title === undefined ? {} : { title: item.title }),
    id: item.id
  };
}

function resolveImageAltText(item: RenderableItemInput): string {
  const explicitAlt = item.image?.alt;

  if (explicitAlt === undefined) {
    return item.title?.value ?? "";
  }

  const trimmedAlt = explicitAlt.trim();

  return trimmedAlt.length === 0 ? (item.title?.value ?? "") : trimmedAlt;
}

function planOptionalItemImage(
  collectionAssetDirectory: PlannedPath,
  item: RenderableItemInput
):
  | {
      readonly imageOutput: PlannedImageOutput;
      readonly outputUrl: ReturnType<typeof createJekyllAssetUrlExpression>;
    }
  | undefined {
  if (item.image === undefined) {
    return undefined;
  }

  const imageFileName = `${item.id.value}.webp`;
  const relativeImagePath = path.posix.join(
    collectionAssetDirectory.relativePath.value,
    imageFileName
  );
  const outputUrl = createJekyllAssetUrlExpression({
    value: `/${relativeImagePath}`
  });

  return {
    imageOutput: {
      crop: item.image.crop,
      itemId: item.id,
      outputPath: {
        absolutePath: {
          value: path.join(collectionAssetDirectory.absolutePath.value, imageFileName)
        },
        relativePath: {
          value: relativeImagePath
        }
      },
      outputUrl,
      sourceFileName: item.image.sourceFileName
    },
    outputUrl
  };
}
