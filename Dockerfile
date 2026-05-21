FROM node:18-alpine

WORKDIR /app

# Install y-webrtc signaling server dependencies.
RUN npm install y-webrtc

# The y-webrtc signaling server reads the PORT env var or defaults to 4444.
EXPOSE 4444

# Start the signaling server
CMD ["node", "./node_modules/y-webrtc/bin/server.js"]
