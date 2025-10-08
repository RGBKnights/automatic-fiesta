# automatic-fiesta

An in-browser video player that uses [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm) to transcode any local video file into an MP4 that can be played instantly.

## Getting started

1. Serve the project with any static file server, for example:

   ```bash
   npx serve .
   ```

2. Open the provided URL in your browser.
3. Select a video file and press **Transcode & Play** to convert it in the browser.

The conversion happens entirely on the client using WebAssembly, so no files ever leave your machine.
