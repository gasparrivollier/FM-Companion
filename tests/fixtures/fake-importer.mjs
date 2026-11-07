// A scripted stand-in for the importer. FAKE_MODE chooses what it does; argv[2], argv[3] are the save and output paths.
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const mode = process.env.FAKE_MODE;
if (mode === "ok") { out({ type: "progress", percent: 10, message: "Leyendo" }); out({ type: "progress", percent: 50, message: "Resolviendo" }); out({ type: "done", outPath: process.argv[3], warnings: ["w1"] }); }
else if (mode === "echo") { out({ type: "done", outPath: process.argv[3], warnings: process.argv.slice(2) }); }
else if (mode === "error") { out({ type: "error", code: "NOT_A_SAVE", message: "x" }); process.exitCode = 1; }
else if (mode === "error-detail") { out({ type: "error", code: "INTERNAL", message: "boom" }); process.exitCode = 1; }
else if (mode === "crash") { out({ type: "progress", percent: 5, message: "a" }); process.exitCode = 3; }
else if (mode === "kill") { out({ type: "progress", percent: 5, message: "a" }); setTimeout(() => process.kill(process.pid, "SIGKILL"), 20); setInterval(() => {}, 1000); }
else if (mode === "hang") { out({ type: "progress", percent: 1, message: "a" }); setInterval(() => {}, 1000); }
else if (mode === "split") {
  const line = JSON.stringify({ type: "progress", percent: 30, message: "mitad" }) + "\n";
  process.stdout.write("ruido que no es json\n");
  process.stdout.write(line.slice(0, 15));
  setTimeout(() => {
    process.stdout.write(line.slice(15) + JSON.stringify({ type: "progress", percent: 60, message: "dos" }) + "\n" + JSON.stringify({ type: "done", outPath: "x", warnings: [] }) + "\n");
  }, 40);
}
