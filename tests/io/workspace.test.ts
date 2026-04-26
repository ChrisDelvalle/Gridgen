import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {
  createCollectionDraft,
  type JekyllBuildPlan,
  parseDraftCollection,
  planJekyllBuild,
  type Result,
  toRenderableCollection
} from "@gridgen/core";
import {
  discoverCollectionFiles,
  readCollectionFile,
  removeStaleGeneratedAssets,
  softDeleteCollection,
  storeSourceImage,
  validateSourceAssets,
  writeCollectionFile,
  writeGeneratedAsset,
  writeJekyllTextOutputs
} from "@gridgen/io";
import { describe, expect, it } from "bun:test";

describe("source workspace IO", () => {
  it("writes collection JSON atomically in the persisted schema and reads it back", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));

    const writeResult = await writeCollectionFile({ collection, workspaceRoot });

    expect(writeResult.ok).toBe(true);

    const collectionFile = path.join(workspaceRoot, "collections", "music.json");
    const rawJson = await fs.readFile(collectionFile, "utf8");

    expect(rawJson).toContain('"id": "music"');
    expect(rawJson).toContain('"id": "section-1"');
    expect(rawJson).not.toContain('"value"');

    const readResult = await readCollectionFile({ collectionFilePath: collectionFile });

    expect(unwrapOk(readResult)).toEqual(collection);
  });

  it("serializes site-local links without leaking value wrappers", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = unwrapOk(parseDraftCollection(createPersistedRenderableCollection("/albums/a/")));

    await writeCollectionFile({ collection, workspaceRoot });

    const rawJson = await fs.readFile(path.join(workspaceRoot, "collections", "music.json"), "utf8");

    expect(rawJson).toContain('"link": "/albums/a/"');
    expect(rawJson).not.toContain('"href"');
  });

  it("discovers sorted collection files and ignores trash", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    await fs.mkdir(path.join(workspaceRoot, "collections"), { recursive: true });
    await fs.mkdir(path.join(workspaceRoot, ".trash", "old", "collections"), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, "collections", "zines.json"), "{}");
    await fs.writeFile(path.join(workspaceRoot, "collections", "music.json"), "{}");
    await fs.writeFile(
      path.join(workspaceRoot, ".trash", "old", "collections", "trash.json"),
      "{}"
    );

    const discovered = unwrapOk(await discoverCollectionFiles({ workspaceRoot }));

    expect(discovered.map((file) => file.collectionId.value)).toEqual(["music", "zines"]);
    expect(discovered.map((file) => file.path.relativePath.value)).toEqual([
      "collections/music.json",
      "collections/zines.json"
    ]);
  });

  it("reports workspace discovery failures through structured errors", async () => {
    const relativeRoot = await discoverCollectionFiles({ workspaceRoot: "relative" });
    const missingCollections = await discoverCollectionFiles({
      workspaceRoot: await makeTemporaryDirectory()
    });
    const workspaceRoot = await makeTemporaryDirectory();

    await fs.mkdir(path.join(workspaceRoot, "collections"), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, "collections", "bad name.json"), "{}");

    const unsafeFile = await discoverCollectionFiles({ workspaceRoot });

    expect(relativeRoot.ok).toBe(false);
    expect(missingCollections.ok).toBe(false);
    expect(unsafeFile.ok).toBe(false);
  });

  it("reports read failures and invalid JSON through structured errors", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const missing = await readCollectionFile({
      collectionFilePath: path.join(workspaceRoot, "collections", "missing.json")
    });

    await fs.mkdir(path.join(workspaceRoot, "collections"), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, "collections", "bad.json"), "{");

    const invalidJson = await readCollectionFile({
      collectionFilePath: path.join(workspaceRoot, "collections", "bad.json")
    });

    expect(missing.ok).toBe(false);
    expect(invalidJson.ok).toBe(false);
  });

  it("stores source images only under collection-owned source directories", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
    const result = await storeSourceImage({
      collectionId: collection.id,
      contents: new TextEncoder().encode("image bytes"),
      sourceFileName: "cover.png",
      workspaceRoot
    });

    expect(result.ok).toBe(true);
    const storedImage = await fs.readFile(
      path.join(workspaceRoot, "assets", "music", "sources", "cover.png"),
      "utf8"
    );

    expect(storedImage).toBe("image bytes");
  });

  it("rejects unsafe source image writes before touching the workspace", async () => {
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
    const unsafeName = await storeSourceImage({
      collectionId: collection.id,
      contents: new Uint8Array([1]),
      sourceFileName: "../cover.png",
      workspaceRoot: await makeTemporaryDirectory()
    });
    const unsafeRoot = await storeSourceImage({
      collectionId: collection.id,
      contents: new Uint8Array([1]),
      sourceFileName: "cover.png",
      workspaceRoot: "relative"
    });

    expect(unsafeName.ok).toBe(false);
    expect(unsafeRoot.ok).toBe(false);
  });

  it("moves collection files and assets into trash for soft delete", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
    await writeCollectionFile({ collection, workspaceRoot });
    await storeSourceImage({
      collectionId: collection.id,
      contents: new Uint8Array([1, 2, 3]),
      sourceFileName: "cover.png",
      workspaceRoot
    });

    const result = await softDeleteCollection({
      collectionId: collection.id,
      timestamp: "2026-04-26-120000",
      workspaceRoot
    });

    expect(result.ok).toBe(true);
    await expectMissing(path.join(workspaceRoot, "collections", "music.json"));
    const trashedCollection = await fs.stat(
      path.join(workspaceRoot, ".trash", "2026-04-26-120000-music", "music.json")
    );
    const trashedImage = await fs.stat(
      path.join(
        workspaceRoot,
        ".trash",
        "2026-04-26-120000-music",
        "assets",
        "sources",
        "cover.png"
      )
    );

    expect(trashedCollection.isFile()).toBe(true);
    expect(trashedImage.isFile()).toBe(true);
  });

  it("reports soft-delete validation failures and tolerates already-missing files", async () => {
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
    const badTimestamp = await softDeleteCollection({
      collectionId: collection.id,
      timestamp: "!!!",
      workspaceRoot: await makeTemporaryDirectory()
    });
    const badRoot = await softDeleteCollection({
      collectionId: collection.id,
      timestamp: "2026-04-26",
      workspaceRoot: "relative"
    });
    const missingFiles = await softDeleteCollection({
      collectionId: collection.id,
      timestamp: "2026-04-26",
      workspaceRoot: await makeTemporaryDirectory()
    });

    expect(badTimestamp.ok).toBe(false);
    expect(badRoot.ok).toBe(false);
    expect(missingFiles.ok).toBe(true);
  });

  it("reports soft-delete filesystem failures with touched paths", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));

    await fs.writeFile(path.join(workspaceRoot, ".trash"), "not a directory");

    const result = await softDeleteCollection({
      collectionId: collection.id,
      timestamp: "2026-04-26",
      workspaceRoot
    });

    expect(result.ok).toBe(false);
  });
});

describe("generated Jekyll output IO", () => {
  it("writes planned include and CSS text outputs atomically", async () => {
    const jekyllRoot = await makeTemporaryDirectory();
    const plan = createBuildPlan(jekyllRoot);
    const result = await writeJekyllTextOutputs({ plan });

    expect(result.ok).toBe(true);
    const include = await fs.readFile(
      path.join(jekyllRoot, "_includes", "gridgen", "music.html"),
      "utf8"
    );
    const stylesheet = await fs.readFile(
      path.join(jekyllRoot, "assets", "gridgen", "gridgen.css"),
      "utf8"
    );

    expect(include).toContain("Generated by gridgen");
    expect(stylesheet).toContain(".gridgen");
  });

  it("reports text output write failures with touched paths", async () => {
    const jekyllRoot = await makeTemporaryDirectory();
    const plan = createBuildPlan(jekyllRoot);

    await fs.writeFile(path.join(jekyllRoot, "_includes"), "not a directory");

    const result = await writeJekyllTextOutputs({ plan });

    expect(result.ok).toBe(false);
  });

  it("writes generated assets only inside assets/gridgen", async () => {
    const jekyllRoot = await makeTemporaryDirectory();
    const plan = createBuildPlan(jekyllRoot);
    const outputPath = plan.imageOutputs[0]?.outputPath;

    if (outputPath === undefined) {
      throw new Error("Expected a planned image output.");
    }

    const result = await writeGeneratedAsset({
      contents: new Uint8Array([1, 2, 3]),
      outputPath
    });

    expect(result.ok).toBe(true);
    const generatedImage = await fs.readFile(
      path.join(jekyllRoot, "assets", "gridgen", "music", "album-a.webp")
    );

    expect(generatedImage).toEqual(Buffer.from([1, 2, 3]));

    const unsafeResult = await writeGeneratedAsset({
      contents: new Uint8Array([4]),
      outputPath: {
        absolutePath: { value: path.join(jekyllRoot, "other.bin") },
        relativePath: { value: "other.bin" }
      }
    });

    expect(unsafeResult.ok).toBe(false);
  });

  it("reports generated asset write failures", async () => {
    const jekyllRoot = await makeTemporaryDirectory();
    const plan = createBuildPlan(jekyllRoot);
    const outputPath = plan.imageOutputs[0]?.outputPath;

    if (outputPath === undefined) {
      throw new Error("Expected image output.");
    }

    await fs.mkdir(path.dirname(path.dirname(outputPath.absolutePath.value)), { recursive: true });
    await fs.writeFile(path.dirname(outputPath.absolutePath.value), "not a directory");

    const result = await writeGeneratedAsset({
      contents: new Uint8Array([1]),
      outputPath
    });

    expect(result.ok).toBe(false);
  });

  it("validates source assets and reports missing files", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
    const noImages = await validateSourceAssets({ collection, workspaceRoot });

    expect(noImages.ok).toBe(true);

    const renderableCollection = unwrapOk(
      parseDraftCollection(createPersistedRenderableCollection("https://example.com/a"))
    );
    const missing = await validateSourceAssets({
      collection: renderableCollection,
      workspaceRoot
    });

    expect(missing.ok).toBe(false);
  });

  it("removes stale generated assets while keeping planned outputs", async () => {
    const jekyllRoot = await makeTemporaryDirectory();
    const plan = createBuildPlan(jekyllRoot);
    const expectedImagePath = plan.imageOutputs[0]?.outputPath.absolutePath.value;

    if (expectedImagePath === undefined) {
      throw new Error("Expected image output.");
    }

    await fs.mkdir(plan.cleanupDirectory.absolutePath.value, { recursive: true });
    await fs.writeFile(expectedImagePath, "expected");
    await fs.writeFile(path.join(plan.cleanupDirectory.absolutePath.value, "old.webp"), "old");
    await fs.mkdir(path.join(plan.cleanupDirectory.absolutePath.value, "nested"));

    const result = await removeStaleGeneratedAssets({ plan });

    expect(result.ok).toBe(true);
    await expectPresent(expectedImagePath);
    await expectPresent(path.join(plan.cleanupDirectory.absolutePath.value, "nested"));
    await expectMissing(path.join(plan.cleanupDirectory.absolutePath.value, "old.webp"));
  });

  it("reports stale cleanup read failures", async () => {
    const jekyllRoot = await makeTemporaryDirectory();
    const plan = createBuildPlan(jekyllRoot);

    await fs.mkdir(path.dirname(plan.cleanupDirectory.absolutePath.value), { recursive: true });
    await fs.writeFile(plan.cleanupDirectory.absolutePath.value, "not a directory");

    const result = await removeStaleGeneratedAssets({ plan });

    expect(result.ok).toBe(false);
  });
});

async function makeTemporaryDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "gridgen-"));
}

async function expectMissing(filePath: string): Promise<void> {
  try {
    await fs.stat(filePath);
  } catch {
    return;
  }

  throw new Error(`Expected missing file: ${filePath}`);
}

async function expectPresent(filePath: string): Promise<void> {
  const stats = await fs.stat(filePath);

  expect(stats.isFile() || stats.isDirectory()).toBe(true);
}

function createBuildPlan(jekyllRoot: string): JekyllBuildPlan {
  const draft = unwrapOk(parseDraftCollection(createPersistedRenderableCollection("https://example.com/a")));
  const renderable = unwrapOk(toRenderableCollection(draft));

  return unwrapOk(planJekyllBuild({ collection: renderable, jekyllRoot }));
}

function createPersistedRenderableCollection(link: string): unknown {
  return {
    id: "music",
    schemaVersion: 1,
    sections: [
      {
        id: "s-tier",
        items: [
          {
            id: "album-a",
            image: {
              crop: {
                height: 100,
                unit: "percent",
                width: 100,
                x: 0,
                y: 0
              },
              sourceFileName: "album-a.png",
              type: "file"
            },
            link,
            title: "Album A"
          }
        ],
        name: "S Tier"
      }
    ],
    title: "Music"
  };
}

function unwrapOk<Value, Failure>(result: Result<Value, Failure>): Value {
  if (!result.ok) {
    throw new Error("Expected an ok result.");
  }

  return result.value;
}
