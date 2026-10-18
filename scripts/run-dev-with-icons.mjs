import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { generateLocalIcons, ICON_SOURCE_PATH } from "./generate-local-icons.mjs";
import { watchLocalIconSources } from "./watch-local-icons.mjs";

try {
  const initial = await generateLocalIcons();
  console.log(`[icons] ${initial.count} ikon lokal siap. Perubahan nama ikon akan diperbarui otomatis.`);
} catch (error) {
  console.error(`[icons] ${error.message}`);
  process.exit(1);
}

const iconWatcher = watchLocalIconSources({
  sourcePath: ICON_SOURCE_PATH,
  async onChange() {
    const result = await generateLocalIcons();
    if (result.changed) console.log(`[icons] ${result.count} ikon lokal diperbarui.`);
  },
  onError(error) {
    console.error(`[icons] ${error.message}`);
  },
});

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const nextProcess = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  iconWatcher.close();
  nextProcess.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
nextProcess.once("error", (error) => {
  console.error(`[dev] ${error.message}`);
  iconWatcher.close();
  process.exitCode = 1;
});
nextProcess.once("exit", (code, signal) => {
  iconWatcher.close();
  process.exitCode = code ?? (signal ? 130 : 1);
});
