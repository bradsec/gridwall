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

## License

This project is licensed under the MIT License.
