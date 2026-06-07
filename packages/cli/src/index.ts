import { Command } from "commander";
import { runAnalyzeCommand } from "./commands/analyze";
import { runInitCommand } from "./commands/init";
import { runServeCommand } from "./commands/serve";
import { runSmokeCommand } from "./commands/smoke";
import { runValidateCommand } from "./commands/validate";
import { runWorkflowCommand } from "./commands/workflow";

const program = new Command();

program.name("bizglance");

program
  .command("init [repo]")
  .description("初始化 .bizglance 工作目录")
  .action(async (repo) => {
    const result = await runInitCommand({ repo });
    console.log(`BizGlance 工作目录已就绪: ${result.workspaceDir}`);
  });

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
  .command("validate <input>")
  .description("校验 BizGlance 文档或 CodeGraph-assisted 输入")
  .option("--kind <kind>", "auto、document 或 context", "auto")
  .action(async (input, options) => {
    const result = await runValidateCommand({
      input,
      kind: options.kind
    });

    console.log(`BizGlance ${result.kind} 校验通过`);
  });

program
  .command("workflow [repo]")
  .description("初始化 .bizglance 并串联 analyze、validate、serve")
  .option("-c, --context <path>", "CodeGraph-assisted 输入 JSON")
  .option("--codegraph-context <path>", "alias for --context")
  .option("--full", "忽略缓存输入，强制使用显式 context 重跑分析")
  .option("--review", "复查已有 .bizglance/bizglance.json，并按需预览")
  .option("--language <language>", "写入 .bizglance/config.json 的输出语言偏好")
  .option("--no-serve", "只生成和校验 .bizglance/bizglance.json，不启动预览")
  .action(async (repo, options) => {
    const result = await runWorkflowCommand({
      repo,
      codegraphContext: options.codegraphContext ?? options.context,
      full: options.full,
      review: options.review,
      language: options.language,
      noServe: options.noServe
    });

    console.log(`BizGlance 工作流完成: ${result.outputPath}`);
    if (result.previewUrl) {
      console.log(result.previewUrl);
    }
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
