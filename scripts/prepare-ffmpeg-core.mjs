import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "node_modules", "@ffmpeg", "core", "dist");
const vendorDir = path.join(rootDir, "vendor", "ffmpeg");

const filesToCopy = [
  "ffmpeg-core.js",
  "ffmpeg-core.wasm",
  "ffmpeg-core.worker.js",
];

const ensureDistExists = async () => {
  try {
    await fs.access(distDir);
  } catch (error) {
    throw new Error(
      "Cannot find @ffmpeg/core assets. Run `npm install` before executing this script."
    );
  }
};

const copyAndHash = async () => {
  await fs.mkdir(vendorDir, { recursive: true });
  const integrity = {};

  for (const file of filesToCopy) {
    const source = path.join(distDir, file);
    const target = path.join(vendorDir, file);

    await fs.copyFile(source, target);
    const data = await fs.readFile(target);
    const hash = crypto.createHash("sha256").update(data).digest("base64");
    integrity[file] = `sha256-${hash}`;
  }

  const metadata = {
    version: "0.12.6",
    files: integrity,
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(vendorDir, "ffmpeg-core.integrity.json"),
    `${JSON.stringify(metadata, null, 2)}\n`
  );

  console.log("FFmpeg core assets prepared:");
  for (const [file, hash] of Object.entries(integrity)) {
    console.log(` - ${file}: ${hash}`);
  }
};

const main = async () => {
  await ensureDistExists();
  await copyAndHash();
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
