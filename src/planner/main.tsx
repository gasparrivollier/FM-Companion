import { createRoot } from "react-dom/client";
import { fetchSnapshotSource, localStorageStorage } from "./state/storage.ts";
import { App } from "./ui/App.tsx";
import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(<App source={fetchSnapshotSource()} storage={localStorageStorage()} />);
