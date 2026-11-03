import sharp from "sharp";
/** Remove long table rules, retaining word positions for source evidence. */
export async function prepareOcrImage(input, output) {
  const { data, info } = await sharp(input, { limitInputPixels: 20e6 })
    .greyscale()
    .normalize()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const source = Buffer.from(data),
    { width, height } = info;
  const vertical = [];
  const erase = (horizontal) => {
    const outer = horizontal ? height : width,
      inner = horizontal ? width : height;
    const minimum = horizontal ? Math.max(100, width * 0.08) : Math.max(100, height * 0.04);
    for (let a = 0; a < outer; a++) {
      let start = -1;
      for (let b = 0; b <= inner; b++) {
        const index = horizontal ? a * width + b : b * width + a;
        if (b < inner && source[index] < 150) {
          if (start < 0) start = b;
          continue;
        }
        if (start >= 0 && b - start >= minimum) {
          if (!horizontal) vertical.push({ x: a, y: start, height: b - start });
          for (let n = start; n < b; n++)
            for (let d = -2; d <= 2; d++) {
              const x = horizontal ? n : a + d,
                y = horizontal ? a + d : n;
              if (x >= 0 && x < width && y >= 0 && y < height) data[y * width + x] = 255;
            }
        }
        start = -1;
      }
    }
  };
  erase(true);
  erase(false);
  await sharp(data, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(output);
  return { width, height, rules: vertical };
}
