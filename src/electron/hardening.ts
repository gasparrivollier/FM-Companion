// Pure helpers for the window's security. No `electron` import, so they are tested in plain Node.

/** The app loads only its own files and makes no network connection. Styles allow inline because React sets style attributes. */
export function cspHeader(): string {
  return [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self' data:",
    "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'",
  ].join("; ");
}

interface WindowLike {
  webContents: {
    setWindowOpenHandler(fn: () => { action: "deny" }): void;
    on(ev: "will-navigate", fn: (e: { preventDefault(): void }, url: string) => void): void;
  };
}

/** No new windows, and no navigation away from the app's own page (a fragment change is fine). */
export function hardenWindow(win: WindowLike, appUrl: string): void {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== appUrl && !url.startsWith(appUrl + "#")) e.preventDefault();
  });
}
