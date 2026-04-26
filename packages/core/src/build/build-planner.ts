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
  type JekyllAssetUrlExpression,
  renderGridCss,
  renderGridHtml,
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
 */
export interface JekyllBuildInput {
  readonly collection: RenderableCollection;
  readonly jekyllRoot: string;
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
  const renderSections: RenderGridSection[] = [];

  for (const section of collection.sections) {
    const renderItems: Array<RenderGridSection["items"][number]> = [];

    for (const item of section.items) {
      const imageFileName = `${item.id.value}.webp`;
      const relativeImagePath = path.posix.join(
        collectionAssetDirectory.relativePath.value,
        imageFileName
      );
      const outputUrl = createJekyllAssetUrlExpression({
        value: `/${relativeImagePath}`
      });

      const imageOutput: PlannedImageOutput = {
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
      };

      imageOutputs.push(imageOutput);
      renderItems.push({
        ...(item.description === undefined ? {} : { description: item.description }),
        id: item.id,
        image: {
          alt:
            item.image.alt === undefined || item.image.alt.trim().length === 0
              ? item.title.value
              : item.image.alt.trim(),
          src: outputUrl
        },
        link: item.link,
        title: item.title
      });
    }

    renderSections.push({
      id: section.id,
      items: renderItems,
      name: section.name
    });
  }

  return {
    imageOutputs,
    renderSections
  };
}
