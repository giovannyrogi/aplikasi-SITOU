import { watch } from "node:fs";
import { basename, dirname } from "node:path";

export function watchLocalIconSources({ sourcePath, onChange, onError = console.error, debounceMs = 150 }) {
  const sourceName = basename(sourcePath).toLowerCase();
  let timer;
  let running = false;
  let pending = false;
  let closed = false;

  async function regenerate() {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    do {
      pending = false;
      try {
        await onChange();
      } catch (error) {
        onError(error);
      }
    } while (pending && !closed);
    running = false;
  }

  // Pantau direktori agar tetap bekerja bila editor mengganti file secara atomik.
  const watcher = watch(dirname(sourcePath), (_event, filename) => {
    if (closed || (filename && String(filename).toLowerCase() !== sourceName)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void regenerate();
    }, debounceMs);
  });
  watcher.on("error", onError);

  return {
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      watcher.close();
    },
  };
}
