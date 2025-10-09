# automatic-fiesta

An in-browser video player built with Vue 3 that uses [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm) to transcode any local video file into an MP4 that can be played instantly.

## Getting started

1. Install dependencies and prepare the FFmpeg core assets that ship with `@ffmpeg/core`:

   ```bash
   npm install
   npm run prepare-core
   ```

   The helper script copies the FFmpeg core files into `public/vendor/ffmpeg`, computes SHA-256
   integrity hashes, and writes them to `public/vendor/ffmpeg/ffmpeg-core.integrity.json`. The
   Vue application verifies the hashes at runtime before loading the core bundle.

2. Start the Vite development server (or build for production):

   ```bash
   npm run dev
   # or
   npm run build
   npm run preview
   ```

3. Open the provided URL in your browser, select a video file, and press **Transcode & Play** to
   convert it entirely in the browser. The conversion uses WebAssembly, so no files ever leave
   your machine.
