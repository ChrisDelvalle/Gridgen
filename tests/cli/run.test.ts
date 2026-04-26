import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { runGridgenCli } from "@gridgen/cli";
import { describe, expect, test } from "bun:test";

describe("gridgen run", () => {
  test("creates the default source workspace and starts the authoring server", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "gridgen-run-"));
    const output = createCliOutput();
    let capturedHostname: string | undefined;
    let capturedPort: number | undefined;
    let stopped = false;
    const exitCode = await runGridgenCli({
      argv: ["run"],
      cwd,
      output,
      serve: (input) => {
        capturedHostname = input.hostname;
        capturedPort = input.port;

        return {
          port: 51_250,
          stop: () => {
            stopped = true;
          }
        };
      },
      waitForRunServer: async (server) => {
        expect(server.host).toBe("127.0.0.1");
        expect(server.port).toBeGreaterThan(0);
        server.stop();
        await Promise.resolve();
      }
    });

    expect(exitCode).toBe(0);
    expect(capturedHostname).toBe("127.0.0.1");
    expect(capturedPort).toBe(0);
    expect(output.stdout).toEqual(["Gridgen authoring server: http://127.0.0.1:51250"]);
    expect(stopped).toBe(true);
    await expectDirectory(path.join(cwd, "gridgen", "collections"));
    await expectDirectory(path.join(cwd, "gridgen", ".trash"));
  });

  test("supports explicit source, port, and browser opening", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "gridgen-run-"));
    const output = createCliOutput();
    const openedUrls: string[] = [];
    let capturedPort: number | undefined;
    const exitCode = await runGridgenCli({
      argv: ["run", "--source", "custom-gridgen", "--port", "0", "--open"],
      cwd,
      openUrl: (url) => {
        openedUrls.push(url);
      },
      output,
      serve: (input) => {
        capturedPort = input.port;

        return {
          port: 51_251,
          stop: () => undefined
        };
      },
      waitForRunServer: async (server) => {
        server.stop();
        await Promise.resolve();
      }
    });

    expect(exitCode).toBe(0);
    expect(capturedPort).toBe(0);
    expect(openedUrls).toEqual(["http://127.0.0.1:51251"]);
    await expectDirectory(path.join(cwd, "custom-gridgen", "collections"));
  });

  test("surfaces startup failures with clear diagnostics", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "gridgen-run-"));
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["run", "--port", "70000"],
      cwd,
      output,
      waitForRunServer: async (server) => {
        server.stop();
        await Promise.resolve();
      }
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("server.invalidPort");
  });

  test("surfaces source workspace creation failures", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "gridgen-run-"));
    const output = createCliOutput();

    await fs.writeFile(path.join(cwd, "gridgen"), "not a directory");

    const exitCode = await runGridgenCli({
      argv: ["run"],
      cwd,
      output
    });

    expect(exitCode).toBe(1);
    expect(output.stderr.join("\n")).toContain("filesystem.writeFailed");
  });

  test("stops the server when browser opening fails", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "gridgen-run-"));
    const output = createCliOutput();
    let stopped = false;
    const exitCode = await runGridgenCli({
      argv: ["run", "--open"],
      cwd,
      openUrl: () => {
        throw new Error("open failed");
      },
      output,
      serve: () => ({
        port: 51_252,
        stop: () => {
          stopped = true;
        }
      })
    });

    expect(exitCode).toBe(1);
    expect(stopped).toBe(true);
    expect(output.stderr.join("\n")).toContain("server.startupFailed");
  });

  test("reports invalid non-numeric port arguments", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "gridgen-run-"));
    const output = createCliOutput();
    const exitCode = await runGridgenCli({
      argv: ["run", "--port", "not-a-port"],
      cwd,
      output
    });

    expect(exitCode).toBe(1);
  });
});

interface CapturedCliOutput {
  readonly stderr: string[];
  readonly stdout: string[];
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

async function expectDirectory(directoryPath: string): Promise<void> {
  const stats = await fs.stat(directoryPath);

  expect(stats.isDirectory()).toBe(true);
}
