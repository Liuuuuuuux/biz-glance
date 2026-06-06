import type { BizGlanceDocument } from "../schema";

export const educationSample: BizGlanceDocument = {
  meta: {
    version: "0.1.0",
    generatedAt: "2026-06-06T00:00:00.000Z",
    source: {
      kind: "sample",
      name: "education",
      lens: "generic-sample"
    },
    warnings: []
  },
  businessObjects: [
    { id: "course", name: "课程", technicalName: "Course", module: "teaching" },
    { id: "enrollment", name: "报名记录", technicalName: "Enrollment", module: "teaching" },
    { id: "progress", name: "学习进度", technicalName: "LearningProgress", module: "learning" },
    { id: "certificate", name: "学习证书", technicalName: "Certificate", module: "learning" }
  ],
  flows: [
    {
      id: "f1",
      from: "course",
      to: "enrollment",
      relation: "creates",
      label: "发起报名",
      sourceKind: "sample",
      confidence: "high",
      evidenceIds: ["e1"]
    },
    {
      id: "f2",
      from: "enrollment",
      to: "progress",
      relation: "updates",
      label: "推进学习",
      sourceKind: "sample",
      confidence: "high",
      evidenceIds: ["e2"]
    },
    {
      id: "f3",
      from: "progress",
      to: "certificate",
      relation: "creates",
      label: "生成证书",
      sourceKind: "sample",
      confidence: "high",
      evidenceIds: ["e3"]
    }
  ],
  statusMutations: [],
  fieldLineages: [],
  evidences: [
    { id: "e1", title: "报名入口", summary: "样例数据：课程创建报名记录" },
    { id: "e2", title: "学习进度更新", summary: "样例数据：报名记录推进学习进度" },
    { id: "e3", title: "证书生成", summary: "样例数据：学习进度完成后生成证书" }
  ]
};
