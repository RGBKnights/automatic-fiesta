const statusMessage = document.getElementById("statusMessage");
const convertButton = document.getElementById("convertButton");
const videoInput = document.getElementById("videoInput");
const logOutput = document.getElementById("logOutput");
const playerSection = document.querySelector(".player");
const videoPlayer = document.getElementById("videoPlayer");
const downloadLink = document.getElementById("downloadLink");

const CORE_VERSION = "0.12.6";
const CORE_PATH = new URL("./vendor/ffmpeg/ffmpeg-core.js", import.meta.url).href;
const CORE_INTEGRITY_PATH = new URL(
  "./vendor/ffmpeg/ffmpeg-core.integrity.json",
  import.meta.url
).href;
const CORE_SETUP_MESSAGE =
  "Run `npm install` followed by `npm run prepare-core` to download the FFmpeg.wasm core locally.";

let selectedFile = null;
let ffmpeg = null;
let isLoading = false;
let hasVerifiedCore = false;

const setStatus = (message) => {
  statusMessage.textContent = message;
};

const appendLog = (message) => {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  logOutput.textContent = `${logOutput.textContent}\n${line}`.trim();
  logOutput.scrollTop = logOutput.scrollHeight;
};

const computeSha256 = async (arrayBuffer) => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBinary = String.fromCharCode(...hashArray);
  return btoa(hashBinary);
};

const verifyLocalCore = async () => {
  if (hasVerifiedCore) {
    return;
  }

  try {
    setStatus("Validating FFmpeg core assets…");
    const metadataResponse = await fetch(CORE_INTEGRITY_PATH, { cache: "no-store" });
    if (!metadataResponse.ok) {
      throw new Error("Missing integrity metadata for the FFmpeg core.");
    }

    const metadata = await metadataResponse.json();
    if (metadata?.version && metadata.version !== CORE_VERSION) {
      appendLog(
        `Warning: expected FFmpeg core version ${CORE_VERSION} but found ${metadata.version}.`
      );
    }

    const expectedIntegrity = metadata?.files?.["ffmpeg-core.js"];
    if (!expectedIntegrity) {
      throw new Error("Integrity data for ffmpeg-core.js is not available.");
    }

    const expectedHash = expectedIntegrity.replace(/^sha256-/, "");

    const coreResponse = await fetch(CORE_PATH, { cache: "no-store" });
    if (!coreResponse.ok) {
      throw new Error("Local FFmpeg core file not found.");
    }

    const coreBuffer = await coreResponse.arrayBuffer();
    const actualHash = await computeSha256(coreBuffer);

    if (actualHash !== expectedHash) {
      throw new Error("Local FFmpeg core integrity check failed.");
    }

    hasVerifiedCore = true;
    appendLog("Verified local FFmpeg core integrity.");
  } catch (error) {
    throw new Error(`${error.message} ${CORE_SETUP_MESSAGE}`);
  }
};

const ensureFFmpeg = async () => {
  if (ffmpeg) {
    return ffmpeg;
  }

  await verifyLocalCore();

  const { createFFmpeg } = FFmpeg;
  ffmpeg = createFFmpeg({
    log: true,
    corePath: CORE_PATH,
  });

  ffmpeg.setLogger(({ message }) => appendLog(message));
  ffmpeg.setProgress(({ ratio }) => {
    const percent = Math.min(100, Math.round(ratio * 100));
    if (!Number.isNaN(percent)) {
      setStatus(`Transcoding… ${percent}%`);
    }
  });

  setStatus("Loading FFmpeg core…");
  await ffmpeg.load();
  setStatus("FFmpeg ready. Choose a file to transcode.");
  appendLog("FFmpeg loaded successfully.");
  return ffmpeg;
};

videoInput.addEventListener("change", (event) => {
  selectedFile = event.target.files?.[0] ?? null;
  if (selectedFile) {
    setStatus(`Selected: ${selectedFile.name}`);
    appendLog(`Selected file ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB).`);
  } else {
    setStatus("Waiting for a file…");
  }
});

const toggleLoading = (loading) => {
  isLoading = loading;
  convertButton.disabled = loading;
  videoInput.disabled = loading;
};

convertButton.addEventListener("click", async () => {
  if (isLoading) {
    return;
  }

  if (!selectedFile) {
    setStatus("Please select a video file first.");
    return;
  }

  try {
    toggleLoading(true);
    const instance = await ensureFFmpeg();

    setStatus("Preparing input file…");

    const { fetchFile } = FFmpegUtil;
    const inputName = "input";
    const outputName = "output.mp4";

    const existingFiles = instance.FS("readdir", "/");
    if (existingFiles.includes(inputName)) {
      instance.FS("unlink", inputName);
    }
    if (existingFiles.includes(outputName)) {
      instance.FS("unlink", outputName);
    }

    instance.FS("writeFile", inputName, await fetchFile(selectedFile));
    appendLog("Starting ffmpeg conversion…");

    await instance.run(
      "-i",
      inputName,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-movflags",
      "faststart",
      outputName
    );

    setStatus("Reading transcoded output…");
    const outputData = instance.FS("readFile", outputName);
    const videoBlob = new Blob([outputData.buffer], { type: "video/mp4" });
    const videoUrl = URL.createObjectURL(videoBlob);

    videoPlayer.src = videoUrl;
    videoPlayer.load();
    playerSection.hidden = false;

    downloadLink.href = videoUrl;
    downloadLink.download = `${selectedFile.name.replace(/\.[^/.]+$/, "") || "video"}-transcoded.mp4`;

    setStatus("Transcode complete! Enjoy the video.");
    appendLog("Conversion finished successfully.");
  } catch (error) {
    console.error(error);
    appendLog(`Error: ${error.message}`);
    setStatus(error.message || "Something went wrong. Check the log for details.");
  } finally {
    toggleLoading(false);
  }
});

appendLog("Ready. Load a video file to begin.");
