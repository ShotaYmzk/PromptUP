// Render public/icons/icon.svg into PNG icons at 16/32/48/128 using sharp.
// Runs as a prebuild step. If `sharp` is unavailable, leaves any existing
// PNGs in place so the extension still loads.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const iconsDir = path.join(rootDir, "public", "icons");
const svgPath = path.join(iconsDir, "icon.svg");

const sizes = [16, 32, 48, 128];

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

async function main() {
  if (!existsSync(svgPath)) {
    console.warn(`[gen-icons] icon source not found at ${svgPath}`);
    return;
  }
  const sharp = await loadSharp();
  if (!sharp) {
    console.warn(
      "[gen-icons] `sharp` is not installed. Run `npm install` to fetch devDependencies, or manually provide PNG icons in public/icons/.",
    );
    return;
  }
  await mkdir(iconsDir, { recursive: true });
  const svg = await readFile(svgPath);
  for (const size of sizes) {
    const out = path.join(iconsDir, `icon-${size}.png`);
    const buffer = await sharp(svg, { density: 320 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(out, buffer);
    console.log(`[gen-icons] wrote ${path.relative(rootDir, out)}`);
  }
}

main().catch((err) => {
  console.error("[gen-icons] failed:", err);
  process.exitCode = 1;
});
