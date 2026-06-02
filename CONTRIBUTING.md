# Contributing to Package Builder

Thank you for your interest in contributing to Package Builder! We welcome contributions of all forms—bug reports, feature suggestions, documentation improvements, and pull requests.

Following these guidelines helps ensure a smooth and productive experience for everyone.

---

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful, welcoming, and inclusive to all contributors.
- Focus on collaborative, constructive feedback and support.
- Avoid harassing, discriminatory, or exclusionary behavior.

---

## Getting Started

### Prerequisites
- **Node.js**: Version `20.x` or higher is recommended.
- **npm**: Standard Node Package Manager (comes bundled with Node).

### Local Setup
1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/Shir0o/package-builder.git
   cd package-builder
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser to see the live editor.

### Local Signaling Server
Real-time peer-to-peer collaboration utilizes WebRTC, which requires an initial signaling handshake. The application uses a public room name and public signaling fallback by default. To test signaling server changes or host a fully local collaboration session:
```bash
PORT=4444 node ./node_modules/y-webrtc/bin/server.js
```

---

## Codebase Architecture

Package Builder is a pure client-side single-page application built on a modern frontend stack:

- **React & Vite**: Fast development server and bundle optimization.
- **TypeScript**: Static typing for robustness.
- **Yjs (`yjs`)**: High-performance CRDT library used for text and document editing state.
- **y-webrtc**: Decentralized real-time peer-to-peer synchronization.
- **y-indexeddb**: Local state persistence inside the browser.
- **File System Access API**: Links the editor directly with physical local files (on compatible browsers).
- **Styling**: Standard CSS located in `src/styles/styles.css`.

---

## Testing & Quality Standards

To maintain high software quality, our repository has a strict test suite coverage requirement.

### Run Tests
```bash
npm test                  # Run tests once
npm run test:watch        # Run tests in watch mode for development
```

### Check Coverage
```bash
npm run coverage
```
> [!IMPORTANT]
> The Continuous Integration (CI) pipeline enforces a **95% code coverage threshold**. Any pull request that reduces coverage below this number will fail the automated checks. Please write unit and integration tests for new features and bug fixes.

### Build and Type Verification
Before submitting a pull request, ensure the TypeScript compilation and Vite build complete successfully:
```bash
npm run build
```

---

## Pull Request Guidelines

1. **Create a branch** for your work:
   - For features: `feature/your-feature-name`
   - For bug fixes: `bugfix/your-bug-name`
2. **Write clear commits** with meaningful messages explaining the *why* behind your changes.
3. **Ensure tests pass** and coverage meets the 95% threshold.
4. **Submit the Pull Request** against the `main` branch.
5. Fill out the provided Pull Request template in full to aid reviewers in understanding your changes.
