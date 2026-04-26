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

describe("gridgen validate", () => {
  it("validates every collection in a source workspace", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = await createRenderableDraft(workspaceRoot);
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["validate", workspaceRoot],
      cwd: workspaceRoot,
      output
    });

    expect(collection.id.value).toBe("music");
    expect(exitCode).toBe(0);
    expect(output.stdout).toEqual(["valid music"]);
    expect(output.stderr).toEqual([]);
  });

  it("validates a single collection file", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    await createRenderableDraft(workspaceRoot);
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["validate", path.join(workspaceRoot, "collections", "music.json")],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(0);
    expect(output.stdout).toEqual(["valid music"]);
  });

  it("returns a non-zero exit code for missing source assets", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
    const sectionId = collection.sections[0]?.id;

    if (sectionId === undefined) {
      throw new Error("Expected starter section.");
    }

    const itemCollection = addRenderableItem(collection, sectionId, "missing.png");
    const output = createCliOutput();

    await writeCollectionFile({ collection: itemCollection, workspaceRoot });

    const exitCode = await runGridgenCli({
      argv: ["validate", workspaceRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("asset.missingFile");
    expect(output.stderr.join("\n")).toContain("itemId=album-a");
  });

  it("returns commander failures without throwing", async () => {
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["unknown"],
      cwd: await makeTemporaryDirectory(),
      output
    });

    expect(exitCode).toBe(1);
  });

  it("reports missing source paths and invalid collection JSON", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const missingOutput = createCliOutput();
    const missingExitCode = await runGridgenCli({
      argv: ["validate", path.join(workspaceRoot, "missing")],
      cwd: workspaceRoot,
      output: missingOutput
    });

    await fs.mkdir(path.join(workspaceRoot, "collections"), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, "collections", "music.json"), "{");

    const invalidOutput = createCliOutput();
    const invalidExitCode = await runGridgenCli({
      argv: ["validate", workspaceRoot],
      cwd: workspaceRoot,
      output: invalidOutput
    });

    expect(missingExitCode).toBe(1);
    expect(missingOutput.stderr.join("\n")).toContain("filesystem.readFailed");
    expect(invalidExitCode).toBe(1);
    expect(invalidOutput.stderr.join("\n")).toContain("filesystem.readFailed");
  });

  it("reports workspace discovery failures from directory sources", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["validate", workspaceRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("filesystem.readFailed");
  });

  it("infers single-file workspaces outside a collections directory", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
    const collection = await createRenderableDraft(workspaceRoot);
    const looseFilePath = path.join(workspaceRoot, "loose.json");
    const output = createCliOutput();

    await fs.rename(path.join(workspaceRoot, "collections", "music.json"), looseFilePath);

    const exitCode = await runGridgenCli({
      argv: ["validate", looseFilePath],
      cwd: workspaceRoot,
      output
    });

    expect(collection.id.value).toBe("music");
    expect(exitCode).toBe(0);
  });

  it("reports renderability failures during validation", async () => {
    const workspaceRoot = await makeTemporaryDirectory();
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
    const output = createCliOutput();

    await writeCollectionFile({ collection: invalidCollection, workspaceRoot });

    const exitCode = await runGridgenCli({
      argv: ["validate", workspaceRoot],
      cwd: workspaceRoot,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("item.invalidLink");
  });
});

interface CapturedCliOutput {
  readonly stderr: string[];
  readonly stdout: string[];
}

async function makeTemporaryDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "gridgen-cli-"));
}

async function createRenderableDraft(workspaceRoot: string): Promise<DraftCollection> {
  const collection = unwrapOk(createCollectionDraft({ title: "Music" }));
  const sectionId = collection.sections[0]?.id;

  if (sectionId === undefined) {
    throw new Error("Expected starter section.");
  }

  const withItem = addRenderableItem(collection, sectionId, "album-a.png");

  await writeCollectionFile({ collection: withItem, workspaceRoot });
  await storeSourceImage({
    collectionId: withItem.id,
    contents: new Uint8Array([1, 2, 3]),
    sourceFileName: "album-a.png",
    workspaceRoot
  });

  return withItem;
}

function addRenderableItem(
  collection: DraftCollection,
  sectionId: DraftCollection["sections"][number]["id"],
  sourceFileName: string
): DraftCollection {
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
