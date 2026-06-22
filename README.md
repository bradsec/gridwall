# Gridwall

Image grids and masonry walls in your browser. Gridwall resizes images and builds grid and masonry composites entirely client-side, static-hostable on GitHub Pages or Cloudflare Pages. No backend, no CDN.

## Features

- Compose multiple images into downloadable grids or masonry layouts
- Square cells with selectable crop framing: smart (saliency), center, or top
- Masonry layout that preserves aspect ratio
- Optional filename labels on cells
- Reorder images by drag, shuffle, or rotate (90 degree steps), with live preview
- Per-image decode skip-and-continue on error
- Multi-file split by height limit, with a file pager in the preview
- JPEG and PNG output with adjustable JPEG quality
- Professional dark UI with live preview
- Fully static-hostable

## Requirements

- Node.js 18+ and npm
- Modern browser with OffscreenCanvas and createImageBitmap support (Chrome 79+, Firefox 82+, Safari 16.4+)

## Installation and Development

Clone the repository and install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:5173 in your browser. The dev server supports hot module reload.

## Building for Production

Build static assets to the `dist/` folder:

```bash
npm run build
```

This runs TypeScript type-checking followed by Vite bundling. The output is a set of static files ready to deploy.

## Preview Built Output

Test the built version locally before deployment:

```bash
npm run preview
```

This starts a preview server on http://localhost:4173 (does not auto-reload).

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Tests use Vitest and cover layout math, resampling, smart-crop logic, grid/masonry composition, and determinism.

## Deployment

### GitHub Pages

1. Build: `npm run build`
2. Push the `dist/` folder to your repository (or configure a workflow to do so)
3. Enable GitHub Pages to serve from the `dist/` folder

### Cloudflare Pages

1. Push the repository to GitHub
2. In Cloudflare Pages, connect to the repository and set:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Cloudflare Pages will run the build and deploy automatically on each push

The app works from any subpath because `vite.config.ts` sets `base: "./"`, making all asset references relative.

### Canonical URL

SEO tags hardcode the production URL `https://bradsec.github.io/gridwall/`. If you deploy to a different domain or path, update it in `index.html` (canonical, `og:url`, `og:image`, `twitter:image`), `public/robots.txt` (Sitemap line), and `public/sitemap.xml` (`<loc>`).

## Compose Mode

The Compose mode in the UI creates grids or masonry layouts from multiple images.

### Square Grid

- Crops every image to an identical square cell
- Tiles them in a fixed grid
- Splits into multiple files when the grid is taller than the max height limit
- Crop modes:
  - `smart`: saliency-based crop, finds the most detailed area
  - `center`: crops from the center
  - `top`: crops from the top (good for portraits and faces)

### Masonry

- Preserves each image's aspect ratio (no cropping)
- Packs images into the shortest column
- Supports per-file pagination via "Per file" setting (0 = all images in one file, otherwise splits into chunks by image count)

### Common Options

- **Columns**: number of columns in the grid
- **Grid width**: output width in pixels
- **Max height per file**: (square-grid mode only) splits the grid into multiple files if it exceeds this height
- **Per file**: (masonry mode only) splits the output by image count per file (0 = all images in one file)
- **Filename labels**: adds a semi-transparent bar with the image filename to each cell
- **Limit**: process only the first N images
- **Format**: JPEG or PNG
- **Quality**: JPEG quality slider (hidden when the format is PNG, which is lossless)

### Image Controls

- **Shuffle**: button in the Images panel; reshuffles the image order on each press
- **Drag handle**: reorder a single image by dragging its grip (works with touch and mouse)
- **Rotate**: rotate an individual image in 90 degree steps; applies to preview and export
- **Remove**: drop a single image
- **Reset**: clear all images and restore default settings

## Deliberate Deviations from the Go Version

The web app is a reimplementation of [goimagegrid](golang_version/) and maintains API and layout parity, with the following intentional differences:

- **Resampler algorithm**: The web app uses repeated halving passes followed by a smoothed final draw, rather than Catmull-Rom spline interpolation. This matches the intent of high-quality downscaling but produces slightly different pixel values. Tests assert dimensions and placement, not pixel-identical output.

- **Smart-crop saliency**: The web version drops the color-cluster term from the Go saliency algorithm, simplifying the calculation while preserving the edge and color-variation components.

- **Shuffle**: The web app shuffles through an explicit button using a mulberry32 generator. Unlike the Go version it does not expose a reproducible seed; each press produces a new random order.

- **Main-thread pipeline**: P1 runs image processing on the main thread during composition. Worker offload is planned for P4 to improve UI responsiveness during heavy batch operations.

See the [design spec](docs/superpowers/specs/2026-06-22-imagegrid-web-design.md) for architecture details.

## Planned Phases (P2-P4)

- **P2**: Batch resize mode (resize many images individually, download as zip)
- **P3**: Gallery export (self-contained responsive HTML/CSS gallery with embedded images)
- **P4**: Web Worker offload for main-thread pixel work and accessibility improvements

## License

This project is licensed under the MIT License.
