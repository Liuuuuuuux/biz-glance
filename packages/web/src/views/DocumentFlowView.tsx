import type { BizGlanceDocument, BusinessObject } from "../../../core/src/index";

export function DocumentFlowView(props: {
  document: BizGlanceDocument;
  selectedObject: BusinessObject | null;
}) {
  const { document, selectedObject } = props;
  const flows = selectedObject
    ? document.flows.filter((item) => item.from === selectedObject.id || item.to === selectedObject.id)
    : [];

  if (flows.length === 0) {
    return <div className="empty-state">当前对象暂未识别到单据流转。</div>;
  }

  return (
    <div className="flow-list">
      {flows.map((item) => (
        <div className="flow-card" key={item.id}>
          <strong>{item.label}</strong>
          <span>
            {item.from} {" -> "} {item.to}
          </span>
        </div>
      ))}
    </div>
  );
}
