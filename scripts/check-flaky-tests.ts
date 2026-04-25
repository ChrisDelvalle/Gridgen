export {};

const DEFAULT_RUN_COUNT = 20;
const MIN_RUN_COUNT = 1;

interface RandomizedTestRunResult {
  exitCode: number;
  output: string;
}

try {
  const runCount = readRunCount(Bun.argv.slice(2), Bun.env["FLAKE_TEST_RUNS"]);

  for (let runNumber = 1; runNumber <= runCount; runNumber += 1) {
    const seed = createSeed();

    const result = await runRandomizedTests(seed);
    if (result.exitCode !== 0) {
      console.error(`Flaky test check failed on run ${runNumber}/${runCount}.`);
      console.error(`Reproduce with: bun test --randomize --seed=${seed} --pass-with-no-tests`);
      printCapturedOutput(result.output);
      process.exit(result.exitCode);
    }
  }

  console.log(`Flaky test check passed after ${runCount} randomized runs.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

function readRunCount(args: string[], environmentValue: string | undefined): number {
  const argumentValue = readRunCountArgument(args);
  const rawValue = argumentValue ?? environmentValue;

  if (rawValue === undefined) {
    return DEFAULT_RUN_COUNT;
  }

  const runCount = Number(rawValue);
  if (!Number.isInteger(runCount) || runCount < MIN_RUN_COUNT) {
    throw new Error(
      "Usage: bun run test:flake [run-count], where run-count is a positive integer."
    );
  }

  return runCount;
}

function readRunCountArgument(args: string[]): string | undefined {
  const values = args.filter((argument) => argument !== "--");

  if (values.length === 0) {
    return undefined;
  }

  if (values.length !== 1) {
    throw new Error("Usage: bun run test:flake [run-count].");
  }

  return values[0];
}

function createSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return values[0] ?? 0;
}

async function runRandomizedTests(seed: number): Promise<RandomizedTestRunResult> {
  const testProcess = Bun.spawn(
    ["bun", "test", "--randomize", `--seed=${seed}`, "--pass-with-no-tests"],
    {
      stderr: "pipe",
      stdout: "pipe"
    }
  );

  const [stdout, stderr, exitCode] = await Promise.all([
    readProcessOutput(testProcess.stdout),
    readProcessOutput(testProcess.stderr),
    testProcess.exited
  ]);

  return {
    exitCode,
    output: [stdout, stderr].filter((value) => value.trim() !== "").join("\n")
  };
}

async function readProcessOutput(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text();
}

function printCapturedOutput(output: string): void {
  const trimmedOutput = output.trimEnd();
  if (trimmedOutput === "") {
    return;
  }

  console.error("");
  console.error("Captured test output:");
  console.error(trimmedOutput);
}
