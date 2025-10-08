# automatic-fiesta

An in-browser video player that uses [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm) to transcode any local video file into an MP4 that can be played instantly.

## Getting started

1. Install the FFmpeg core package and copy the distributable files into `vendor/ffmpeg`:

   ```bash
   npm install
   npm run prepare-core
   ```

   The helper script computes SHA-256 integrity hashes for the copied assets and saves them to
   `vendor/ffmpeg/ffmpeg-core.integrity.json`. The web app verifies the hashes at runtime before
   loading the core.

2. Serve the project with any static file server, for example:

   ```bash
   npx serve .
   ```

3. Open the provided URL in your browser.
4. Select a video file and press **Transcode & Play** to convert it in the browser.

The conversion happens entirely on the client using WebAssembly, so no files ever leave your machine.
