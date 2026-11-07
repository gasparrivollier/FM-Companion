import { createRoot } from "react-dom/client";
import type { FmApi } from "../electron/api.ts";
import { electronImporter, electronOwnerStorage, electronSnapshotSource } from "./state/electron.ts";
import { fetchSnapshotSource, localStorageStorage } from "./state/storage.ts";
import { App } from "./ui/App.tsx";
import "./ui/styles.css";

// Inside Electron the preload provides window.fm; in a plain browser (npm run dev) the dev seams are used and there is no import button.
const fm = (window as unknown as { fm?: FmApi }).fm;
createRoot(document.getElementById("root")!).render(
  fm ? (
    <App source={electronSnapshotSource(fm)} storage={electronOwnerStorage(fm)} importer={electronImporter(fm)}
      dataTools={{ backupAndReset: fm.owner.backupAndReset, openFolder: fm.owner.openFolder }} lifecycle={fm.lifecycle} />
  ) : (
    <App source={fetchSnapshotSource()} storage={localStorageStorage()} />
  ),
);
