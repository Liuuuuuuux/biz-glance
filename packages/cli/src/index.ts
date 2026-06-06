import { Command } from "commander";
import { runAnalyzeCommand } from "./commands/analyze";
import { runServeCommand } from "./commands/serve";

const program = new Command();

program.name("bizglance");

program
  .command("analyze")
  .requiredOption("--out <path>")
  .option("--sample <name>")
  .option("--repo <path>")
  .option("--lens <name>", "analysis lens", "java-spring")
  .action(async (options) => {
    await runAnalyzeCommand(options);
  });

program
  .command("serve")
  .requiredOption("--data <path>")
  .action(async (options) => {
    const url = await runServeCommand(options);
    console.log(url);
  });

await program.parseAsync(process.argv);
