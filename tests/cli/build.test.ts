import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { runGridgenCli } from "@gridgen/cli";
import {
  CollectionOperationType,
  createCollectionDraft,
  type DraftCollection,
  parseDraftLink,
  type Result,
  updateCollection
} from "@gridgen/core";
import { storeSourceImage, writeCollectionFile } from "@gridgen/io";
import { describe, expect, it } from "bun:test";

describe("gridgen build", () => {
  it("builds one collection file into Jekyll include and CSS outputs", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-build-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-build-jekyll-");
    await createAndStoreRenderableDraft(workspaceRoot, "Music", "album-a.png");
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["build", path.join(workspaceRoot, "collections", "music.json"), jekyllRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(0);
    expect(output.stdout).toEqual([
      "wrote _includes/gridgen/music.html",
      "wrote assets/gridgen/music/album-a.webp",
      "wrote assets/gridgen/gridgen.css"
    ]);
    await expectFileContains(
      path.join(jekyllRoot, "_includes", "gridgen", "music.html"),
      "{{ '/assets/gridgen/music/album-a.webp' | relative_url }}"
    );
    await expectFileContains(path.join(jekyllRoot, "assets", "gridgen", "gridgen.css"), ".gridgen");
    await expectFileStartsWith(
      path.join(jekyllRoot, "assets", "gridgen", "music", "album-a.webp"),
      "RIFF"
    );
  });

  it("builds every collection in a source workspace", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-build-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-build-jekyll-");
    await createAndStoreRenderableDraft(workspaceRoot, "Music", "album-a.png");
    await createAndStoreRenderableDraft(workspaceRoot, "Movies", "movie-a.png");
    await fs.mkdir(path.join(jekyllRoot, "assets", "gridgen", "music"), { recursive: true });
    await fs.writeFile(path.join(jekyllRoot, "assets", "gridgen", "music", "stale.webp"), "stale");
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["build", workspaceRoot, jekyllRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(0);
    expect(output.stdout).toEqual([
      "wrote _includes/gridgen/movies.html",
      "wrote assets/gridgen/movies/album-a.webp",
      "wrote _includes/gridgen/music.html",
      "wrote assets/gridgen/music/album-a.webp",
      "wrote assets/gridgen/gridgen.css"
    ]);
    await expectFileContains(
      path.join(jekyllRoot, "_includes", "gridgen", "music.html"),
      "Album A"
    );
    await expectFileContains(
      path.join(jekyllRoot, "_includes", "gridgen", "movies.html"),
      "Album A"
    );
    await expectMissing(path.join(jekyllRoot, "assets", "gridgen", "music", "stale.webp"));
  });

  it("refuses invalid collections before writing output", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-build-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-build-jekyll-");
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
    const sectionId = collection.sections[0]?.id;

    if (sectionId === undefined) {
      throw new Error("Expected starter section.");
    }

    const invalidCollection = unwrapOk(
      updateCollection(collection, {
        sectionId,
        title: "Album A",
        type: CollectionOperationType.AddItem
      })
    );

    await writeCollectionFile({ collection: invalidCollection, workspaceRoot });
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["build", workspaceRoot, jekyllRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("item.invalidLink");
    await expectMissing(path.join(jekyllRoot, "_includes", "gridgen", "music.html"));
  });

  it("does not report success or write includes when image generation fails", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-build-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-build-jekyll-");
    await writeCollectionFile({
      collection: createRenderableDraft("Music", "missing.png"),
      workspaceRoot
    });
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["build", workspaceRoot, jekyllRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join("\n")).toContain("asset.missingFile");
    await expectMissing(path.join(jekyllRoot, "_includes", "gridgen", "music.html"));
  });

  it("reports invalid build collection JSON before planning output", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-build-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-build-jekyll-");
    const output = createCliOutput();

    await fs.mkdir(path.join(workspaceRoot, "collections"), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, "collections", "music.json"), "{");

    const exitCode = await runGridgenCli({
      argv: ["build", workspaceRoot, jekyllRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("filesystem.readFailed");
  });

  it("reports text write failures with possibly touched files", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-build-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-build-jekyll-");
    const output = createCliOutput();

    await createAndStoreRenderableDraft(workspaceRoot, "Music", "album-a.png");
    await fs.mkdir(path.join(jekyllRoot, "assets", "gridgen", "gridgen.css"), {
      recursive: true
    });

    const exitCode = await runGridgenCli({
      argv: ["build", workspaceRoot, jekyllRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("filesystem.writeFailed");
    expect(output.stderr.join("\n")).toContain("possibly touched");
  });

  it("reports missing build source paths", async () => {
    const workspaceRoot = await makeTemporaryDirectory("gridgen-build-workspace-");
    const jekyllRoot = await makeTemporaryDirectory("gridgen-build-jekyll-");
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["build", path.join(workspaceRoot, "missing"), jekyllRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("filesystem.readFailed");
  });
});

interface CapturedCliOutput {
  readonly stderr: string[];
  readonly stdout: string[];
}

async function makeTemporaryDirectory(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function expectFileContains(filePath: string, expectedText: string): Promise<void> {
  const contents = await fs.readFile(filePath, "utf8");

  expect(contents).toContain(expectedText);
}

async function expectFileStartsWith(filePath: string, expectedText: string): Promise<void> {
  const contents = await fs.readFile(filePath);

  expect(contents.subarray(0, expectedText.length).toString("utf8")).toBe(expectedText);
}

async function expectMissing(filePath: string): Promise<void> {
  try {
    await fs.stat(filePath);
  } catch {
    return;
  }

  throw new Error(`Expected missing file: ${filePath}`);
}

function createRenderableDraft(title: string, sourceFileName: string): DraftCollection {
  const collection = unwrapOk(createCollectionDraft({ title }));
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
    throw new Error("Expected created item.");
  }

  return unwrapOk(
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
          sourceFileName: { value: sourceFileName },
          type: "file"
        },
        link: unwrapOk(parseDraftLink("https://example.com"))
      },
      type: CollectionOperationType.UpdateItem
    })
  );
}

async function createAndStoreRenderableDraft(
  workspaceRoot: string,
  title: string,
  sourceFileName: string
): Promise<DraftCollection> {
  const collection = createRenderableDraft(title, sourceFileName);

  await writeCollectionFile({
    collection,
    workspaceRoot
  });
  await storeSourceImage({
    collectionId: collection.id,
    contents: createPng(),
    sourceFileName,
    workspaceRoot
  });

  return collection;
}

function createPng(): Uint8Array {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  );
}

function createCliOutput(): CapturedCliOutput & {
  readonly error: (message: string) => void;
  readonly log: (message: string) => void;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    error: (message: string) => {
      stderr.push(message);
    },
    log: (message: string) => {
      stdout.push(message);
    },
    stderr,
    stdout
  };
}

function unwrapOk<Value, Failure>(result: Result<Value, Failure>): Value {
  if (!result.ok) {
    throw new Error("Expected an ok result.");
  }

  return result.value;
}
