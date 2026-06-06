import { Command } from "commander";
import { runAnalyzeCommand } from "./commands/analyze";
import { runServeCommand } from "./commands/serve";
import { runSmokeCommand } from "./commands/smoke";

const program = new Command();

program.name("bizglance");

program
  .command("analyze")
  .requiredOption("--out <path>")
  .option("--sample <name>")
  .option("--repo <path-or-github-url>")
  .option("--lens <name>", "analysis lens", "java-spring")
  .option("--codegraph-context <path>", "external CodeGraph context and LLM findings JSON")
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

program
  .command("smoke")
  .option("--repo <path>", "fixture or repository path", "fixtures/java-spring-mini")
  .option("--out <path>", "generated smoke output", "dist/smoke.bizglance.json")
  .action(async (options) => {
    const result = await runSmokeCommand(options);

    console.log(`Smoke 验证通过: ${result.outputPath}`);
    console.log(
      [
        `业务对象: ${result.objectCount}`,
        `业务关系: ${result.flowCount}`,
        `状态变更: ${result.statusMutationCount}`,
        `字段血缘: ${result.fieldLineageCount}`,
        `代码证据: ${result.evidenceCount}`
      ].join(" | ")
    );
  });

await program.parseAsync(process.argv);
