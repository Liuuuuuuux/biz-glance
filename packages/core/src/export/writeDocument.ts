import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BizGlanceDocument } from "../schema";

export async function writeDocument(filePath: string, document: BizGlanceDocument) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(document, null, 2), "utf8");
}
