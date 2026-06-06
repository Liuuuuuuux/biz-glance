import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { loadDocument } from "./lib/loadDocument";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const params = new URLSearchParams(window.location.search);
const dataPath = params.get("data") ?? "/current.bizglance.json";

async function bootstrap() {
  try {
    const document = await loadDocument(dataPath);
    root.render(
      <React.StrictMode>
        <App initialDocument={document} />
      </React.StrictMode>
    );
  } catch (error) {
    root.render(
      <div className="app-shell">
        <div className="empty-state page-error">
          {error instanceof Error ? error.message : "加载数据失败。"}
        </div>
      </div>
    );
  }
}

void bootstrap();
