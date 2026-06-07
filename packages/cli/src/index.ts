import { Command } from "commander";
import { runAnalyzeCommand } from "./commands/analyze";
import { runServeCommand } from "./commands/serve";
import { runSmokeCommand } from "./commands/smoke";

const program = new Command();

program.name("bizglance");

program
  .command("analyze [repo]")
  .option("-o, --out <path>", "generated BizGlance JSON", "dist/bizglance.json")
  .option("--sample <name>")
  .option("--repo <path>", "alias for the local repo argument")
  .option("-c, --context <path>", "CodeGraph context and LLM findings JSON")
  .option("--codegraph-context <path>", "alias for --context")
  .action(async (repo, options) => {
    await runAnalyzeCommand({
      ...options,
      repo: options.repo ?? repo,
      codegraphContext: options.codegraphContext ?? options.context
    });
  });

program
  .command("serve")
  .option("-d, --data <path>", "BizGlance JSON to preview", "dist/bizglance.json")
  .action(async (options) => {
    const url = await runServeCommand(options);
    console.log(url);
  });

program
  .command("smoke")
  .option("--repo <path>", "fixture or repository path", ".")
  .option("--codegraph-context <path>", "external CodeGraph context and LLM findings JSON", "fixtures/codegraph/shop-context.json")
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
