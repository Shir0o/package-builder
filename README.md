# Package Builder

A block-based editor for assembling printable study/conference packages — schedules, verse references, headings, notes — and exporting them to PDF, HTML, Markdown, plain text, or JSON.

Pure client-side: a single-page React + Vite app with no backend. Documents are saved to your browser (localStorage) and optionally linked to a local file via the File System Access API.

## File Storage & Collaboration Behavior

### 📂 File System Access & Browser Compatibility
The **"Link file..."** and **"Open linked..."** features allow you to sync the editor directly with a local file on your computer's hard drive.
* **Supported Browsers:** Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Opera).
* **Unsupported Browsers:** Safari, Firefox, and mobile browsers (iOS/Android). On these browsers, the linking options are hidden, and users must use the standard **"Open..."** button to upload a file into the browser's temporary memory.

### 👥 Collaboration Syncing & File Overwrite Behavior
When you share a session via the **"Share..."** button, edits from all participants are synchronized in real-time over a serverless peer-to-peer WebRTC connection.
* **Global Overrides:** If any participant in a shared room opens a new file or clicks "New", the entire active session updates for **all** participants.
* **Disk File Overwrites:** If you are hosting the session and have a physical file linked to your workspace, any updates from other participants (including if they load a new file) will trigger your local auto-save and overwrite your linked physical file.

### 🛡️ Data Preservation Best Practices
To keep your work safe when collaborating:
1. **Export backups frequently:** Use **Export -> Package source (.json)** to download manual backups of your project.
2. **Host - Unlink your file before sharing:** Click **"Unlink"** before sharing a room link. This detaches the editor from your physical disk file while keeping the room active. You can re-link your local file once collaboration is finished.
3. **Leave before opening other files:** If you are a guest in a shared room and want to open a different package file, click **"Leave shared session"** first to go back to Solo mode so you don't overwrite the active room for everyone else.
4. **Use Undo/Redo:** Press `Cmd+Z` / `Ctrl+Z` (or use the toolbar arrows) to undo accidental changes across the shared room.

## Develop

### Prerequisites
- **Node.js**: Version `20.x` or higher is recommended.
- **npm**: Standard Node Package Manager.

### Setup & Commands
```bash
npm install          # Install dependencies
npm run dev          # Start the local Vite development server
npm test             # Run test suite with Vitest
npm run coverage     # Generate code coverage reports
npm run build        # Build optimized production bundle to dist/
```

## Collaboration & Deployment

This application supports real-time, peer-to-peer collaboration using WebRTC. While editing data is synced directly between browsers, an initial handshake requires a lightweight signaling server.

For detailed steps on deploying the static frontend, hosting your own signaling server, and using environment/runtime overrides, see the [Production Deployment Guide](DEPLOY.md).

### Quick Start: Local Signaling Server
If public signaling servers are down or blocked by your browser, you can run your own local signaling server for testing:
```bash
PORT=4444 node ./node_modules/y-webrtc/bin/server.js
```

### Production Deployments
* **Frontend**: Build the static assets via `npm run build` and host the `dist/` folder on Cloudflare Pages, Netlify, GitHub Pages, or Vercel.
* **Signaling Server**: Run the provided `Dockerfile` on any container platform (Render, Fly.io, Railway, Google Cloud Run).

## Contributing

We welcome community contributions! Please read our [Contributing Guide](CONTRIBUTING.md) to understand our development workflows, coding standards, and testing expectations.

## License

[MIT](LICENSE)

