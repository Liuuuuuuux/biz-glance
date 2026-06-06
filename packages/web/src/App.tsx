import { useEffect, useMemo, useState } from "react";
import type { BizGlanceDocument } from "../../core/src/index";
import { WorkbenchLayout } from "./components/WorkbenchLayout";

type ViewName = "document" | "status" | "field";

export default function App({ initialDocument }: { initialDocument: BizGlanceDocument }) {
  const [view, setView] = useState<ViewName>("document");
  const [selectedObjectId, setSelectedObjectId] = useState(
    initialDocument.businessObjects[0]?.id ?? ""
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const filteredObjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return initialDocument.businessObjects.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        (item.technicalName ?? "").toLowerCase().includes(normalizedQuery);
      const matchesModule = moduleFilter === "all" || item.module === moduleFilter;

      return matchesQuery && matchesModule;
    });
  }, [initialDocument.businessObjects, moduleFilter, searchQuery]);

  useEffect(() => {
    if (filteredObjects.some((item) => item.id === selectedObjectId)) {
      return;
    }

    setSelectedObjectId(filteredObjects[0]?.id ?? "");
  }, [filteredObjects, selectedObjectId]);

  const selectedObject = useMemo(
    () => filteredObjects.find((item) => item.id === selectedObjectId) ?? null,
    [filteredObjects, selectedObjectId]
  );

  return (
    <WorkbenchLayout
      document={initialDocument}
      filteredObjects={filteredObjects}
      view={view}
      selectedObject={selectedObject}
      searchQuery={searchQuery}
      moduleFilter={moduleFilter}
      importDialogOpen={importDialogOpen}
      onViewChange={setView}
      onSelectObject={setSelectedObjectId}
      onSearchQueryChange={setSearchQuery}
      onModuleFilterChange={setModuleFilter}
      onOpenImportDialog={() => setImportDialogOpen(true)}
      onCloseImportDialog={() => setImportDialogOpen(false)}
    />
  );
}
