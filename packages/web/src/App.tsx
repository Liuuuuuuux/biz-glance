import { useMemo, useState } from "react";
import type { BizGlanceDocument } from "../../core/src/index";
import { WorkbenchLayout } from "./components/WorkbenchLayout";

type ViewName = "document" | "status" | "field";

export default function App({ initialDocument }: { initialDocument: BizGlanceDocument }) {
  const [view, setView] = useState<ViewName>("document");
  const [selectedObjectId, setSelectedObjectId] = useState(
    initialDocument.businessObjects[0]?.id ?? ""
  );

  const selectedObject = useMemo(
    () =>
      initialDocument.businessObjects.find((item) => item.id === selectedObjectId) ?? null,
    [initialDocument.businessObjects, selectedObjectId]
  );

  return (
    <WorkbenchLayout
      document={initialDocument}
      view={view}
      selectedObject={selectedObject}
      onViewChange={setView}
      onSelectObject={setSelectedObjectId}
    />
  );
}
