# Package Builder

A block-based editor for assembling printable study/conference packages — schedules, verse references, headings, notes — and exporting them to PDF, HTML, Markdown, plain text, or JSON.

Pure client-side: a single-page React + Vite app with no backend. Documents are saved to your browser (localStorage) and optionally linked to a local file via the File System Access API.

## Develop

```bash
npm install
npm run dev      # vite dev server
npm test         # vitest
npm run build    # production build to dist/
```

## Deploy

The build output in `dist/` is a static site. Drop it on any static host (Cloudflare Pages, Netlify, GitHub Pages, etc.).

**Cloudflare Pages**
- Build command: `npm run build`
- Output directory: `dist`
- No environment variables required.

## License

[MIT](LICENSE)
