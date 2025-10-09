# automatic-fiesta

An in-browser video player built with Vue 3 that uses [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm) to transcode any local video file into an MP4 that can be played instantly.

## Getting started

1. Install dependencies and obtain the FFmpeg core assets. Choose **one** of the following paths:

   **Option A – use the authenticated npm registry (recommended)**

   ```bash
   npm config set @ffmpeg:registry https://registry.npmjs.org/
   npm login --scope=@ffmpeg --registry=https://registry.npmjs.org/
   # or, in CI, export a token: npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
   npm install
   ```

   **Option B – manual fallback if registry access is unavailable**

   ```bash
   mkdir -p public/vendor/ffmpeg
   curl -L https://registry.npmjs.org/@ffmpeg/core/-/core-0.12.6.tgz \
     | tar -xz --strip-components=2 -C public/vendor/ffmpeg \
       package/dist/ffmpeg-core.js \
       package/dist/ffmpeg-core.wasm \
       package/dist/ffmpeg-core.worker.js
   ```

   Install the remaining npm dependencies as you normally would—the manual files only replace the
   `@ffmpeg/core` download. If `npm install` still reports a 403 for other `@ffmpeg/*` packages,
   install the public dependencies (Vue, Vite, etc.) individually and mirror the tarball approach
   above for any additional FFmpeg modules you need.

   Then prepare the assets (for either option):

   ```bash
   npm run prepare-core
   ```

   The helper script copies (or validates) the FFmpeg core files in `public/vendor/ffmpeg`,
   computes SHA-256 integrity hashes, and writes them to
   `public/vendor/ffmpeg/ffmpeg-core.integrity.json`. The Vue application verifies the hashes at
   runtime before loading the core bundle.

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
