import type { BizGlanceDocument, BusinessObject } from "../../../core/src/index";
import { DocumentFlowView } from "../views/DocumentFlowView";
import { FieldLineageView } from "../views/FieldLineageView";
import { StatusFlowView } from "../views/StatusFlowView";

type ViewName = "document" | "status" | "field";

function getViewMeta(view: ViewName, document: BizGlanceDocument, selectedObject: BusinessObject | null) {
  if (view === "status") {
    return {
      title: "状态从入口到持久化",
      description: "把状态字段、触发方法和目标状态拆出来，适合测试设计状态覆盖，也方便开发定位状态写入位置。",
      pill: "Status Flow"
    };
  }

  if (view === "field") {
    return {
      title: "字段来源与计算逻辑",
      description: "字段血缘视图关注一个值的来源、变换和目标，帮助研发交接、测试断言和业务口径对齐。",
      pill: "Field Lineage"
    };
  }

  const firstFlow = selectedObject
    ? document.flows.find((item) => item.from === selectedObject.id || item.to === selectedObject.id)
    : document.flows[0];
  const fromName = document.businessObjects.find((item) => item.id === firstFlow?.from)?.name ?? "业务对象";
  const toName = document.businessObjects.find((item) => item.id === firstFlow?.to)?.name ?? "下游对象";

  return {
    title: `${fromName}到${toName}`,
    description: "把一个业务对象会生成、更新或引用哪些下游对象从调用链里提取出来，供业务和研发共同确认边界。",
    pill: "Document Flow"
  };
}

export function WorkbenchLayout(props: {
  document: BizGlanceDocument;
  filteredObjects: BusinessObject[];
  view: ViewName;
  selectedObject: BusinessObject | null;
  searchQuery: string;
  moduleFilter: string;
  importDialogOpen: boolean;
  onViewChange: (view: ViewName) => void;
  onSelectObject: (id: string) => void;
  onSearchQueryChange: (value: string) => void;
  onModuleFilterChange: (value: string) => void;
  onOpenImportDialog: () => void;
  onCloseImportDialog: () => void;
}) {
  const {
    document,
    filteredObjects,
    view,
    selectedObject,
    searchQuery,
    moduleFilter,
    importDialogOpen,
    onViewChange,
    onSelectObject,
    onSearchQueryChange,
    onModuleFilterChange,
    onOpenImportDialog,
    onCloseImportDialog
  } = props;
  const evidenceIds = new Set<string>();
  const modules = Array.from(
    new Set(document.businessObjects.map((item) => item.module).filter(Boolean))
  ) as string[];
  const viewMeta = getViewMeta(view, document, selectedObject);

  document.flows
    .filter((item) => !selectedObject || item.from === selectedObject.id || item.to === selectedObject.id)
    .forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)));

  document.statusMutations
    .filter((item) => !selectedObject || item.objectId === selectedObject.id)
    .forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)));

  document.fieldLineages
    .filter((item) => !selectedObject || item.objectId === selectedObject.id)
    .forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)));

  const evidenceList = document.evidences.filter((item) => evidenceIds.size === 0 || evidenceIds.has(item.id));

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div>
            <p className="eyebrow">BizGlance</p>
            <h1>业务分析工作台</h1>
          </div>
          <button className="topbar-action" onClick={onOpenImportDialog} type="button">
            导入项目
          </button>
        </div>
      </header>
      <div className="workbench">
        <aside className="sidebar">
          <h2>业务对象</h2>
          <div className="filter-stack">
            <input
              className="field-control"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="搜索业务对象"
              type="search"
              value={searchQuery}
            />
            <label className="field-label">
              <span>模块筛选</span>
              <select
                aria-label="模块筛选"
                className="field-control"
                onChange={(event) => onModuleFilterChange(event.target.value)}
                value={moduleFilter}
              >
                <option value="all">全部模块</option>
                {modules.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="object-list">
            {filteredObjects.map((item) => (
              <button
                className={item.id === selectedObject?.id ? "object-item active" : "object-item"}
                key={item.id}
                onClick={() => onSelectObject(item.id)}
                type="button"
              >
                <strong>{item.name}</strong>
                <span>{item.technicalName ?? item.id}</span>
              </button>
            ))}
            {filteredObjects.length === 0 ? (
              <div className="empty-state">没有匹配的业务对象。</div>
            ) : null}
          </div>
        </aside>
        <main className="canvas">
          <div className="tabs" role="tablist" aria-label="视图切换">
            <button
              aria-selected={view === "document"}
              className="tab-btn"
              onClick={() => onViewChange("document")}
              type="button"
            >
              单据流转
            </button>
            <button
              aria-selected={view === "status"}
              className="tab-btn"
              onClick={() => onViewChange("status")}
              type="button"
            >
              状态流转
            </button>
            <button
              aria-selected={view === "field"}
              className="tab-btn"
              onClick={() => onViewChange("field")}
              type="button"
            >
              字段血缘
            </button>
          </div>
          <div className="view-head">
            <div>
              <h2>{viewMeta.title}</h2>
              <p>{viewMeta.description}</p>
            </div>
            <span className="view-pill">{viewMeta.pill}</span>
          </div>
          {view === "document" && (
            <DocumentFlowView document={document} selectedObject={selectedObject} />
          )}
          {view === "status" && <StatusFlowView document={document} selectedObject={selectedObject} />}
          {view === "field" && <FieldLineageView document={document} selectedObject={selectedObject} />}
        </main>
        <aside className="inspector">
          <h2>代码证据</h2>
          {selectedObject ? <p className="inspector-title">{selectedObject.name}</p> : null}
          {evidenceList.length === 0 ? (
            <div className="empty-state">当前对象暂未识别到明确证据。</div>
          ) : (
            <div className="evidence-list">
              {evidenceList.map((item) => (
                <div className="evidence-card" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  {item.filePath ? <span className="evidence-meta">{item.filePath}</span> : null}
                  {item.route ? <span className="evidence-meta">Route: {item.route}</span> : null}
                  {item.lines ? (
                    <span className="evidence-meta">
                      Lines: {item.lines.start}-{item.lines.end}
                    </span>
                  ) : null}
                  {item.symbol ? <span>{item.symbol}</span> : null}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
      {importDialogOpen ? (
        <div className="dialog-backdrop" onClick={onCloseImportDialog}>
          <div
            aria-labelledby="import-dialog-title"
            className="dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="dialog-head">
              <div>
                <h2 id="import-dialog-title">导入项目</h2>
                <p>填写代码库路径和分析范围，BizGlance 会生成业务图谱数据。</p>
              </div>
              <button className="dialog-close" onClick={onCloseImportDialog} type="button">
                关闭
              </button>
            </div>
            <div className="dialog-body">
              <p>当前版本请先通过 CLI 运行 `bizglance analyze` 生成数据文件，再用 `bizglance serve` 打开预览。</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
