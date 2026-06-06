import type { BizGlanceDocument, BusinessObject } from "../../../core/src/index";

export function StatusFlowView(props: {
  document: BizGlanceDocument;
  selectedObject: BusinessObject | null;
}) {
  const { document, selectedObject } = props;
  const items = selectedObject
    ? document.statusMutations.filter((item) => item.objectId === selectedObject.id)
    : [];

  if (items.length === 0) {
    return <div className="empty-state">当前对象暂未识别到状态流转。</div>;
  }

  return (
    <div className="flow-list">
      {items.map((item) => (
        <div className="flow-card" key={item.id}>
          <strong>{item.trigger}</strong>
          <span>
            {item.field}: {item.fromStatus ?? "?"} {" -> "} {item.toStatus ?? "?"}
          </span>
        </div>
      ))}
    </div>
  );
}
