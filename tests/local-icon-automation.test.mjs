import assert from "node:assert/strict";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { generateLocalIcons } from "../scripts/generate-local-icons.mjs";
import { watchLocalIconSources } from "../scripts/watch-local-icons.mjs";

async function iconFixture(run) {
  const directory = await mkdtemp(join(process.cwd(), ".tmp-icon-automation-"));
  const sourcePath = join(directory, "navigationIconSources.mjs");
  const outputPath = join(directory, "localIconData.mjs");
  try {
    await run({ sourcePath, outputPath });
  } finally {
    await unlink(sourcePath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rmdir(directory);
  }
}

function source(iconName) {
  return `export const NAVIGATION_ICON_SOURCES = { "navigation:test": "${iconName}" };\n`;
}

test("generator membaca nama baru, tetapi nama salah tidak menimpa SVG lama", async () => {
  await iconFixture(async ({ sourcePath, outputPath }) => {
    await writeFile(sourcePath, source("solar:widget-2-bold-duotone"));
    assert.equal((await generateLocalIcons({ sourcePath, outputPath })).changed, true);
    const first = await readFile(outputPath, "utf8");
    assert.equal((await generateLocalIcons({ sourcePath, outputPath, check: true })).changed, false);

    await writeFile(sourcePath, source("solar:widget-4-bold-duotone"));
    await assert.rejects(generateLocalIcons({ sourcePath, outputPath, check: true }), /belum sesuai/);
    assert.equal((await generateLocalIcons({ sourcePath, outputPath })).changed, true);
    const second = await readFile(outputPath, "utf8");
    assert.notEqual(second, first);

    await writeFile(sourcePath, source("solar:ikon-tidak-ada-bold-duotone"));
    await assert.rejects(generateLocalIcons({ sourcePath, outputPath }), /tidak ditemukan/);
    assert.equal(await readFile(outputPath, "utf8"), second);
  });
});

test("pemantau memperbarui data ikon setelah nama diubah saat proses berjalan", async () => {
  await iconFixture(async ({ sourcePath, outputPath }) => {
    await writeFile(sourcePath, source("solar:widget-2-bold-duotone"));
    await generateLocalIcons({ sourcePath, outputPath });
    const before = await readFile(outputPath, "utf8");
    let resolveUpdate;
    let rejectUpdate;
    const updated = new Promise((resolve, reject) => {
      resolveUpdate = resolve;
      rejectUpdate = reject;
    });
    const watcher = watchLocalIconSources({
      sourcePath,
      debounceMs: 25,
      async onChange() {
        await generateLocalIcons({ sourcePath, outputPath });
        resolveUpdate();
      },
      onError: rejectUpdate,
    });
    const timeout = setTimeout(() => rejectUpdate(new Error("Perubahan ikon tidak terpantau.")), 3000);
    try {
      await writeFile(sourcePath, source("solar:widget-4-bold-duotone"));
      await updated;
      assert.notEqual(await readFile(outputPath, "utf8"), before);
    } finally {
      clearTimeout(timeout);
      watcher.close();
    }
  });
});
