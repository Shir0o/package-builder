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

## Collaboration & Deployment

This application supports real-time, peer-to-peer collaboration using WebRTC. While editing data is synced directly between browsers, an initial handshake requires a lightweight signaling server.

For detailed steps on deploying the static frontend, hosting your own signaling server, and using environment/runtime overrides, see the [Deployment & Self-Hosting Guide](DEPLOY.md).

### Quick Start: Local Signaling Server
If public signaling servers are down or blocked by your browser, you can run your own local signaling server for testing:
```bash
PORT=4444 node ./node_modules/y-webrtc/bin/server.js
```

### Production Deployments
* **Frontend**: Build the static assets via `npm run build` and host the `dist/` folder on Cloudflare Pages, Netlify, GitHub Pages, or Vercel.
* **Signaling Server**: Run the provided `Dockerfile` on any container platform (Render, Fly.io, Railway).

## License

[MIT](LICENSE)
