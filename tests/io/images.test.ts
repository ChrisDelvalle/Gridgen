import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {
  CollectionOperationType,
  createCollectionDraft,
  GridgenErrorCode,
  type JekyllBuildPlan,
  parseDraftLink,
  planJekyllBuild,
  type PlannedImageOutput,
  type Result,
  toRenderableCollection,
  updateCollection
} from "@gridgen/core";
import {
  createPreviewImage,
  maxSourceImageBytes,
  processPlannedImage,
  processPlannedImages,
  storeSourceImage
} from "@gridgen/io";
import { describe, expect, it } from "bun:test";

describe("image processing", () => {
  it("generates deterministic 512 by 512 WebP assets from planned source images", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(workspaceRoot, jekyllRoot, createPng());
    const result = await processPlannedImages({
      collectionId: plan.collectionId,
      imageOutputs: plan.imageOutputs,
      workspaceRoot
    });

    expect(result.ok).toBe(true);

    const outputPath = plan.imageOutputs[0]?.outputPath.absolutePath.value;

    if (outputPath === undefined) {
      throw new Error("Expected image output.");
    }

    const generatedImage = await fs.readFile(outputPath);

    expect(generatedImage.subarray(0, 4).toString("utf8")).toBe("RIFF");
    expect(generatedImage.subarray(8, 12).toString("utf8")).toBe("WEBP");
  });

  it("rejects oversized source images before image processing", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(workspaceRoot, jekyllRoot, new Uint8Array([1]));
    const sourcePath = path.join(workspaceRoot, "assets", "music", "sources", "album-a.png");

    await fs.truncate(sourcePath, maxSourceImageBytes + 1);

    const result = await processPlannedImages({
      collectionId: plan.collectionId,
      imageOutputs: plan.imageOutputs,
      workspaceRoot
    });

    expect(unwrapErr(result).error.code).toBe(GridgenErrorCode.AssetTooLarge);
  });

  it("rejects non-file source image paths", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(workspaceRoot, jekyllRoot, createPng());
    const sourcePath = path.join(workspaceRoot, "assets", "music", "sources", "album-a.png");

    await fs.rm(sourcePath);
    await fs.mkdir(sourcePath);

    const result = await processPlannedImages({
      collectionId: plan.collectionId,
      imageOutputs: plan.imageOutputs,
      workspaceRoot
    });

    expect(unwrapErr(result).error.code).toBe(GridgenErrorCode.AssetMissingFile);
  });

  it("rejects unsafe source workspace roots before image processing", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(workspaceRoot, jekyllRoot, createPng());
    const result = await processPlannedImages({
      collectionId: plan.collectionId,
      imageOutputs: plan.imageOutputs,
      workspaceRoot: "relative"
    });

    expect(unwrapErr(result).error.code).toBe(GridgenErrorCode.PathUnsafe);
  });

  it("generates preview WebP bytes without writing output", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(workspaceRoot, jekyllRoot, createPng());
    const imageOutput = plan.imageOutputs[0];

    if (imageOutput === undefined) {
      throw new Error("Expected image output.");
    }

    const result = await createPreviewImage({
      collectionId: plan.collectionId,
      crop: imageOutput.crop,
      sourceFileName: imageOutput.sourceFileName,
      workspaceRoot
    });

    expect(unwrapOk(result).subarray(0, 4).toString()).toBe("RIFF");
  });

  it("reports preview image planning and source validation failures", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(workspaceRoot, jekyllRoot, createPng());
    const imageOutput = plan.imageOutputs[0];

    if (imageOutput === undefined) {
      throw new Error("Expected image output.");
    }

    const unsafeRoot = await createPreviewImage({
      collectionId: plan.collectionId,
      crop: imageOutput.crop,
      sourceFileName: imageOutput.sourceFileName,
      workspaceRoot: "relative"
    });

    await fs.rm(path.join(workspaceRoot, "assets", "music", "sources", "album-a.png"));

    const missingSource = await createPreviewImage({
      collectionId: plan.collectionId,
      crop: imageOutput.crop,
      sourceFileName: imageOutput.sourceFileName,
      workspaceRoot
    });

    expect(unwrapErr(unsafeRoot).code).toBe(GridgenErrorCode.PathUnsafe);
    expect(unwrapErr(missingSource).code).toBe(GridgenErrorCode.AssetMissingFile);
  });

  it("rejects unsupported raster inputs", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(
      workspaceRoot,
      jekyllRoot,
      new TextEncoder().encode("not an image")
    );
    const result = await processPlannedImages({
      collectionId: plan.collectionId,
      imageOutputs: plan.imageOutputs,
      workspaceRoot
    });

    expect(unwrapErr(result).error.code).toBe(GridgenErrorCode.AssetUnsupportedType);
  });

  it("rejects images without usable dimensions", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(
      workspaceRoot,
      jekyllRoot,
      new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    );
    const result = await processPlannedImages({
      collectionId: plan.collectionId,
      imageOutputs: plan.imageOutputs,
      workspaceRoot
    });

    expect(unwrapErr(result).error.code).toBe(GridgenErrorCode.AssetUnsupportedType);
  });

  it("rejects invalid crop metadata", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-image-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-image-jekyll-");
    const plan = await createImagePlan(workspaceRoot, jekyllRoot, createPng());
    const imageOutput = plan.imageOutputs[0];

    if (imageOutput === undefined) {
      throw new Error("Expected image output.");
    }

    const invalidImageOutput: PlannedImageOutput = {
      ...imageOutput,
      crop: {
        height: 100,
        unit: "percent",
        width: 0,
        x: 0,
        y: 0
      }
    };
    const result = await processPlannedImage({
      collectionId: plan.collectionId,
      imageOutput: invalidImageOutput,
      workspaceRoot
    });

    expect(unwrapErr(result).error.code).toBe(GridgenErrorCode.AssetInvalidCrop);
  });
});

async function makeTemporaryDirectory(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function createPng(): Uint8Array {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  );
}

async function createImagePlan(
  workspaceRoot: string,
  jekyllRoot: string,
  sourceImage: Uint8Array
): Promise<JekyllBuildPlan> {
  const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
  const sectionId = collection.sections[0]?.id;

  if (sectionId === undefined) {
    throw new Error("Expected starter section.");
  }

  const withItem = unwrapOk(
    updateCollection(collection, {
      sectionId,
      title: "Album A",
      type: CollectionOperationType.AddItem
    })
  );
  const itemId = withItem.sections[0]?.items[0]?.id;

  if (itemId === undefined) {
    throw new Error("Expected item.");
  }

  const withImage = unwrapOk(
    updateCollection(withItem, {
      itemId,
      patch: {
        image: {
          crop: {
            height: 100,
            unit: "percent",
            width: 100,
            x: 0,
            y: 0
          },
          sourceFileName: { value: "album-a.png" },
          type: "file"
        },
        link: unwrapOk(parseDraftLink("https://example.com"))
      },
      type: CollectionOperationType.UpdateItem
    })
  );
  const renderable = unwrapOk(toRenderableCollection(withImage));

  await storeSourceImage({
    collectionId: withImage.id,
    contents: sourceImage,
    sourceFileName: "album-a.png",
    workspaceRoot
  });

  return unwrapOk(planJekyllBuild({ collection: renderable, jekyllRoot }));
}

function unwrapOk<Value, Failure>(result: Result<Value, Failure>): Value {
  if (!result.ok) {
    throw new Error("Expected an ok result.");
  }

  return result.value;
}

function unwrapErr<Value, Failure>(result: Result<Value, Failure>): Failure {
  if (result.ok) {
    throw new Error("Expected an error result.");
  }

  return result.error;
}
