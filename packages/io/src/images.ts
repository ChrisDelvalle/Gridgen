import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  createAssetError,
  err,
  type GridgenError,
  GridgenErrorCode,
  type ImageCrop,
  type JekyllBuildPlan,
  ok,
  type PlannedImageOutput,
  planSourceWorkspacePaths,
  type Result
} from "@gridgen/core";
import sharp from "sharp";

import { type IoWriteFailure, type IoWriteReport, writeGeneratedAsset } from "./workspace";

/**
 * Maximum accepted source image upload size in bytes.
 */
export const maxSourceImageBytes = 20 * 1024 * 1024;

const generatedImageSizePixels = 512;

/**
 * Planned image processing input.
 *
 * @property imageOutput Planned output produced by the core build planner.
 * @property plan Owning build plan.
 * @property workspaceRoot Absolute source workspace root.
 */
export interface ProcessPlannedImageInput {
  readonly imageOutput: PlannedImageOutput;
  readonly plan: JekyllBuildPlan;
  readonly workspaceRoot: string;
}

/**
 * Processes every planned image for one build plan.
 *
 * @param input Planned image batch input.
 * @param input.plan Owning build plan.
 * @param input.workspaceRoot Absolute source workspace root.
 * @returns Write report or a structured image/write failure.
 */
export async function processPlannedImages(input: {
  readonly plan: JekyllBuildPlan;
  readonly workspaceRoot: string;
}): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const touchedPaths: string[] = [];

  for (const imageOutput of input.plan.imageOutputs) {
    const result = await processPlannedImage({
      imageOutput,
      plan: input.plan,
      workspaceRoot: input.workspaceRoot
    });

    if (!result.ok) {
      return err({
        error: result.error.error,
        touchedPaths: [...touchedPaths, ...result.error.touchedPaths]
      });
    }

    touchedPaths.push(...result.value.touchedPaths);
  }

  return ok({ touchedPaths });
}

/**
 * Processes one planned source image into a 512 by 512 WebP output.
 *
 * @param input Planned image processing input.
 * @returns Write report or a structured image/write failure.
 */
export async function processPlannedImage(
  input: ProcessPlannedImageInput
): Promise<Result<IoWriteReport, IoWriteFailure>> {
  const sourcePath = planSourceImagePath(input);

  if (!sourcePath.ok) {
    return err({ error: sourcePath.error, touchedPaths: [] });
  }

  const sizeValidation = await validateSourceImageSize(sourcePath.value);

  if (!sizeValidation.ok) {
    return err({ error: sizeValidation.error, touchedPaths: [] });
  }

  const imageBuffer = await createGeneratedImageBuffer(sourcePath.value, input.imageOutput.crop);

  if (!imageBuffer.ok) {
    return err({ error: imageBuffer.error, touchedPaths: [] });
  }

  return writeGeneratedAsset({
    contents: imageBuffer.value,
    outputPath: input.imageOutput.outputPath
  });
}

function planSourceImagePath(input: ProcessPlannedImageInput): Result<string, GridgenError> {
  const paths = planSourceWorkspacePaths({
    collectionId: input.plan.collectionId,
    workspaceRoot: input.workspaceRoot
  });

  if (!paths.ok) {
    return paths;
  }

  return ok(
    path.join(
      paths.value.collectionSourcesDirectory.absolutePath.value,
      input.imageOutput.sourceFileName.value
    )
  );
}

async function validateSourceImageSize(
  sourcePath: string
): Promise<Result<undefined, GridgenError>> {
  try {
    const stats = await fs.stat(sourcePath);

    if (!stats.isFile()) {
      return err(
        createAssetError(GridgenErrorCode.AssetMissingFile, "Source image file is missing.", {
          displayPath: sourcePath
        })
      );
    }

    if (stats.size > maxSourceImageBytes) {
      return err(
        createAssetError(GridgenErrorCode.AssetTooLarge, "Source image exceeds the upload limit.", {
          displayPath: sourcePath
        })
      );
    }

    return ok(undefined);
  } catch {
    return err(
      createAssetError(GridgenErrorCode.AssetMissingFile, "Source image file is missing.", {
        displayPath: sourcePath
      })
    );
  }
}

async function createGeneratedImageBuffer(
  sourcePath: string,
  crop: ImageCrop
): Promise<Result<Uint8Array, GridgenError>> {
  try {
    const image = sharp(sourcePath, { failOn: "warning" });
    const metadata = await image.metadata();
    const cropRegion = toPixelCrop(crop, metadata.width, metadata.height);

    if (!cropRegion.ok) {
      return cropRegion;
    }

    return ok(
      await image
        .extract(cropRegion.value)
        .resize(generatedImageSizePixels, generatedImageSizePixels, { fit: "cover" })
        .webp()
        .toBuffer()
    );
  } catch {
    return err(
      createAssetError(
        GridgenErrorCode.AssetUnsupportedType,
        "Unsupported or unreadable source image.",
        {
          displayPath: sourcePath
        }
      )
    );
  }
}

function toPixelCrop(
  crop: ImageCrop,
  imageWidth: number | undefined,
  imageHeight: number | undefined
): Result<sharp.Region, GridgenError> {
  if (
    imageWidth === undefined ||
    imageHeight === undefined ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    // Sharp usually rejects unreadable inputs before this point. Keep this
    // guard for supported formats that still fail to expose dimensions.
    return err(
      createAssetError(
        GridgenErrorCode.AssetUnsupportedType,
        "Source image dimensions are unavailable."
      )
    );
  }

  const left = Math.floor((crop.x / 100) * imageWidth);
  const top = Math.floor((crop.y / 100) * imageHeight);
  const right = Math.round(((crop.x + crop.width) / 100) * imageWidth);
  const bottom = Math.round(((crop.y + crop.height) / 100) * imageHeight);
  const width = right - left;
  const height = bottom - top;

  if (
    left < 0 ||
    top < 0 ||
    width <= 0 ||
    height <= 0 ||
    left + width > imageWidth ||
    top + height > imageHeight
  ) {
    return err(
      createAssetError(GridgenErrorCode.AssetInvalidCrop, "Crop is outside source image bounds.")
    );
  }

  return ok({
    height,
    left,
    top,
    width
  });
}
