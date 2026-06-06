import type { BizGlanceDocument, BusinessObject } from "../../../core/src/index";

export function FieldLineageView(props: {
  document: BizGlanceDocument;
  selectedObject: BusinessObject | null;
}) {
  const { document, selectedObject } = props;
  const items = selectedObject
    ? document.fieldLineages.filter((item) => item.objectId === selectedObject.id)
    : [];

  if (items.length === 0) {
    return <div className="empty-state">当前对象暂未识别到字段血缘。</div>;
  }

  return (
    <div className="flow-list">
      {items.map((item) => (
        <div className="flow-card" key={item.id}>
          <strong>{item.targetField}</strong>
          <span>{item.sourceFields.join(", ")}</span>
        </div>
      ))}
    </div>
  );
}
