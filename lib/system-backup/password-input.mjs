/** Terminal interaktif menyembunyikan ketikan; pipe tetap didukung untuk otomasi aman. */
export async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) value += chunk.toString("utf8");
    return value.replace(/[\r\n]+$/, "");
  }
  process.stdout.write("Kata sandi backup: ");
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", receive);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const receive = (buffer) => {
      const chunk = buffer.toString("utf8");
      if (chunk === "\r" || chunk === "\n") finish();
      else if (chunk === "\u0003") finish(new Error("Dibatalkan."));
      else if (chunk === "\u007f" || chunk === "\b") value = value.slice(0, -1);
      else if (!/[\r\n]/.test(chunk) && value.length < 128) value += chunk;
    };
    process.stdin.on("data", receive);
  });
}
