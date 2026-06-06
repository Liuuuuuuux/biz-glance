import type { BizGlanceDocument, BusinessObject } from "../../../core/src/index";
import { DocumentFlowView } from "../views/DocumentFlowView";
import { FieldLineageView } from "../views/FieldLineageView";
import { StatusFlowView } from "../views/StatusFlowView";

type ViewName = "document" | "status" | "field";

export function WorkbenchLayout(props: {
  document: BizGlanceDocument;
  view: ViewName;
  selectedObject: BusinessObject | null;
  onViewChange: (view: ViewName) => void;
  onSelectObject: (id: string) => void;
}) {
  const { document, view, selectedObject, onViewChange, onSelectObject } = props;
  const evidenceIds = new Set<string>();

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
          <div className="object-list">
            {document.businessObjects.map((item) => (
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
