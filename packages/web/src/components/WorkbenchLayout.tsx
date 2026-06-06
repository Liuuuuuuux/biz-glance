import type { BizGlanceDocument, BusinessObject } from "../../../core/src/index";
import { DocumentFlowView } from "../views/DocumentFlowView";
import { FieldLineageView } from "../views/FieldLineageView";
import { StatusFlowView } from "../views/StatusFlowView";

type ViewName = "document" | "status" | "field";

export function WorkbenchLayout(props: {
  document: BizGlanceDocument;
  filteredObjects: BusinessObject[];
  view: ViewName;
  selectedObject: BusinessObject | null;
  searchQuery: string;
  moduleFilter: string;
  onViewChange: (view: ViewName) => void;
  onSelectObject: (id: string) => void;
  onSearchQueryChange: (value: string) => void;
  onModuleFilterChange: (value: string) => void;
}) {
  const {
    document,
    filteredObjects,
    view,
    selectedObject,
    searchQuery,
    moduleFilter,
    onViewChange,
    onSelectObject,
    onSearchQueryChange,
    onModuleFilterChange
  } = props;
  const evidenceIds = new Set<string>();
  const modules = Array.from(
    new Set(document.businessObjects.map((item) => item.module).filter(Boolean))
  ) as string[];

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
        <div>
          <p className="eyebrow">BizGlance</p>
          <h1>业务分析工作台</h1>
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
                  {item.symbol ? <span>{item.symbol}</span> : null}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
