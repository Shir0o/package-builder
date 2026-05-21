# Production Deployment Guide

This guide details how to deploy both the frontend application and the custom WebRTC signaling server for production use. Since the application is open source and self-hostable, it is built to be easily configured at build time or runtime.

---

## 1. Deploying the Frontend (Static Hosting)

The frontend is a pure static single-page application (React + Vite). It can be deployed for free on any static host.

### Build Configuration
* **Build Command**: `npm run build`
* **Output Directory**: `dist`

### Specifying Custom Signaling Servers (Build Time)
By default, the application uses local development fallback (`ws://localhost:4444`) and public `y-webrtc` signaling servers. To compile the application with your own private signaling servers, set the `VITE_SIGNALING_SERVERS` environment variable on your static hosting provider:

```bash
VITE_SIGNALING_SERVERS=wss://signaling.yourdomain.com,wss://backup-signaling.yourdomain.com
```

### Hosting Provider Setup
* **Cloudflare Pages / Vercel / Netlify**: 
  1. Connect your repository.
  2. Set the build command to `npm run build` and output directory to `dist`.
  3. Under environment variables, add `VITE_SIGNALING_SERVERS` with your signaling URLs.
* **GitHub Pages**:
  * Use a GitHub Action (like `actions/deploy-pages`) to build the site and deploy the `dist` folder. If setting custom signaling servers, define `VITE_SIGNALING_SERVERS` as a repository secret or pass it directly in the build action step:
    ```yaml
    env:
      VITE_SIGNALING_SERVERS: wss://signaling.yourdomain.com
    ```

---

## 2. Deploying the Signaling Server

WebRTC requires a lightweight signaling server to introduce peer browsers. The repository includes a `Dockerfile` to make hosting the signaling server on modern container services trivial.

### Hosting with Docker (Render, Fly.io, Railway, Google Cloud Run)
The included `Dockerfile` spins up the `y-webrtc` signaling server automatically.

#### Option A: Railway
1. Create a new project on Railway.
2. Select **Deploy from GitHub repo** and choose your repository.
3. Railway will automatically detect the `Dockerfile` and build it.
4. Go to **Variables** and ensure `PORT` is generated (Railway binds this automatically).
5. Go to **Settings** and click **Generate Domain** to get your public websocket URL (e.g., `wss://your-project.up.railway.app`).

#### Option B: Fly.io
1. Install the `flyctl` CLI and run `fly auth login`.
2. Run `fly launch` in the repository root.
3. Fly.io will detect the `Dockerfile` and configure a container.
4. Under `fly.toml`, ensure the internal port maps correctly:
   ```toml
   [[services]]
     internal_port = 4444
     protocol = "tcp"
   ```
5. Deploy using `fly deploy`. Your WebSocket URL will be `wss://<app-name>.fly.dev`.

#### Option C: Render
1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Choose **Docker** as the runtime.
4. Render will build and deploy the container. Your URL will be `wss://<app-name>.onrender.com`. Note: Render's free tier spins down after inactivity, which will cause a delay when the first peer joins.

---

## 3. Runtime Signaling Overrides (For Self-Hosters)

To accommodate open-source self-hosters who want to deploy the static frontend once but let individual users/groups use their own signaling servers, the app supports runtime overrides without rebuilding.

### Override via URL Query Parameter
You can append `signaling` as a parameter to the hash or the query string of your shared link. It accepts a comma-separated list of WebSocket URLs:

```
https://yourdomain.com/#room=my-room-name&signaling=wss://custom-sig.org,wss://backup-sig.org
```

When peers open this URL, they will automatically ignore the built-in signaling servers and connect only to `wss://custom-sig.org` and `wss://backup-sig.org`.

### Override via localStorage
For power users who always want to use their own signaling servers across sessions, you can set it directly in the browser console:

```javascript
localStorage.setItem("collab-signaling-servers", "wss://my-sig-server.com");
```

To clear this override and revert to the default servers, run:
```javascript
localStorage.removeItem("collab-signaling-servers");
```
