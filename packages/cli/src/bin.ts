import { runGridgenCli } from "./index";

const exitCode = await runGridgenCli({
  argv: Bun.argv.slice(2),
  cwd: process.cwd(),
  output: {
    error: (message) => {
      process.stderr.write(`${message}\n`);
    },
    log: (message) => {
      process.stdout.write(`${message}\n`);
    }
  }
});

process.exitCode = exitCode;
