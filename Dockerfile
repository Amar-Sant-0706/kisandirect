# ==============================================================================
# Production Dockerfile for KisanDirect AI (Node.js + SQLite Multi-Portal App)
# ==============================================================================
FROM node:22-alpine AS base

# Install build dependencies for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Run build step if needed
RUN npm run build || true

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["npm", "start"]
