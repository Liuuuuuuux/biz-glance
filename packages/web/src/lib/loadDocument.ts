import type { BizGlanceDocument } from "../../../core/src/index";

export async function loadDocument(url: string): Promise<BizGlanceDocument> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`无法加载数据文件：${url}`);
  }

  return response.json();
}
