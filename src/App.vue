<template>
  <main>
    <header>
      <h1>FFmpeg.wasm Online Video Player</h1>
      <p>
        Load any local video file, transcode it to MP4 directly in your browser using
        <code>ffmpeg.wasm</code>, and play it instantly without leaving the page.
      </p>
    </header>

    <section class="uploader">
      <label class="file-label">
        <span>Select a video file</span>
        <input
          ref="fileInput"
          type="file"
          accept="video/*"
          :disabled="isLoading"
          @change="onFileChange"
        />
      </label>
      <button type="button" :disabled="isLoading" @click="onConvert">
        {{ isLoading ? "Working…" : "Transcode & Play" }}
      </button>
      <p class="status">{{ statusMessage }}</p>
    </section>

    <section class="player" v-if="hasVideo">
      <video ref="videoPlayer" controls :src="videoSource"></video>
      <a class="download" :href="videoSource" :download="downloadName">
        Download transcoded video
      </a>
    </section>

    <section class="log">
      <h2>Transcode Log</h2>
      <pre ref="logOutput">{{ formattedLog }}</pre>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { fetchFile } from "@ffmpeg/util";
import { createFFmpeg } from "mmpeg-wasm";

const CORE_VERSION = "0.12.6";
const CORE_SETUP_MESSAGE =
  "Run `npm install` followed by `npm run prepare-core` to download the FFmpeg.wasm core locally.";

const ensureTrailingSlash = (value) => (value.endsWith("/") ? value : `${value}/`);
const basePath = ensureTrailingSlash(import.meta.env.BASE_URL ?? "/");
const resolvePublicAsset = (asset) => `${basePath}${asset}`;

const CORE_PATH = resolvePublicAsset("vendor/ffmpeg/ffmpeg-core.js");
const CORE_INTEGRITY_PATH = resolvePublicAsset("vendor/ffmpeg/ffmpeg-core.integrity.json");

const statusMessage = ref("Waiting for a file…");
const logs = ref([]);
const isLoading = ref(false);
const selectedFile = ref(null);
const videoSource = ref(null);
const downloadName = ref("video-transcoded.mp4");
const ffmpegInstance = shallowRef(null);
const hasVerifiedCore = ref(false);

const fileInput = ref(null);
const videoPlayer = ref(null);
const logOutput = ref(null);

const formattedLog = computed(() => logs.value.join("\n"));
const hasVideo = computed(() => Boolean(videoSource.value));

const setStatus = (message) => {
  statusMessage.value = message;
};

const appendLog = (message) => {
  logs.value.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  nextTick(() => {
    if (logOutput.value) {
      logOutput.value.scrollTop = logOutput.value.scrollHeight;
    }
  });
};

const computeSha256 = async (arrayBuffer) => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBinary = String.fromCharCode(...hashArray);
  return btoa(hashBinary);
};

const verifyLocalCore = async () => {
  if (hasVerifiedCore.value) {
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

    hasVerifiedCore.value = true;
    appendLog("Verified local FFmpeg core integrity.");
  } catch (error) {
    throw new Error(`${error.message} ${CORE_SETUP_MESSAGE}`);
  }
};

const ensureFFmpeg = async () => {
  if (ffmpegInstance.value) {
    return ffmpegInstance.value;
  }

  await verifyLocalCore();

  const instance = createFFmpeg({
    log: true,
    corePath: CORE_PATH,
  });

  instance.setLogger(({ message }) => appendLog(message));
  instance.setProgress(({ ratio }) => {
    const percent = Math.min(100, Math.round(ratio * 100));
    if (!Number.isNaN(percent)) {
      setStatus(`Transcoding… ${percent}%`);
    }
  });

  setStatus("Loading FFmpeg core…");
  await instance.load();
  setStatus("FFmpeg ready. Choose a file to transcode.");
  appendLog("FFmpeg loaded successfully.");
  ffmpegInstance.value = instance;
  return instance;
};

const toggleLoading = (loading) => {
  isLoading.value = loading;
  if (fileInput.value) {
    fileInput.value.disabled = loading;
  }
};

const releaseCurrentVideoUrl = () => {
  if (!videoSource.value) {
    return;
  }

  URL.revokeObjectURL(videoSource.value);
  videoSource.value = null;
};

const onFileChange = (event) => {
  const file = event.target.files?.[0] ?? null;
  selectedFile.value = file;

  if (file) {
    setStatus(`Selected: ${file.name}`);
    appendLog(`Selected file ${file.name} (${Math.round(file.size / 1024)} KB).`);
  } else {
    setStatus("Waiting for a file…");
  }
};

const onConvert = async () => {
  if (isLoading.value) {
    return;
  }

  if (!selectedFile.value) {
    setStatus("Please select a video file first.");
    return;
  }

  try {
    toggleLoading(true);
    const instance = await ensureFFmpeg();

    setStatus("Preparing input file…");

    const inputName = "input";
    const outputName = "output.mp4";

    const existingFiles = instance.FS("readdir", "/");
    if (existingFiles.includes(inputName)) {
      instance.FS("unlink", inputName);
    }
    if (existingFiles.includes(outputName)) {
      instance.FS("unlink", outputName);
    }

    instance.FS("writeFile", inputName, await fetchFile(selectedFile.value));
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
    const previousUrl = videoSource.value;
    let nextUrl = null;

    try {
      nextUrl = URL.createObjectURL(videoBlob);
      videoSource.value = nextUrl;
      downloadName.value = `${
        selectedFile.value.name.replace(/\.[^/.]+$/, "") || "video"
      }-transcoded.mp4`;

      await nextTick();
      if (videoPlayer.value) {
        videoPlayer.value.load();
      }

      if (previousUrl && previousUrl !== nextUrl) {
        URL.revokeObjectURL(previousUrl);
      }
    } catch (blobError) {
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }

      if (previousUrl && previousUrl !== videoSource.value) {
        videoSource.value = previousUrl;
      }

      throw blobError;
    }

    setStatus("Transcode complete! Enjoy the video.");
    appendLog("Conversion finished successfully.");
  } catch (error) {
    console.error(error);
    appendLog(`Error: ${error.message}`);
    setStatus(error.message || "Something went wrong. Check the log for details.");
  } finally {
    toggleLoading(false);
  }
};

const handleBeforeUnload = () => {
  try {
    releaseCurrentVideoUrl();
  } catch (error) {
    console.error("Failed to release video resources during unload", error);
  }
};

onMounted(() => {
  appendLog("Ready. Load a video file to begin.");
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
  handleBeforeUnload();
});
</script>
