# ==============================================================================
# KisanDirect AI - Unified Full-Stack Production Container
# Multi-Portal Agricultural Marketplace & DOCA Regulatory Control Room
# ==============================================================================

FROM node:20-bookworm-slim AS production

# Install build tools required by native C++ addons (better-sqlite3) & curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy package manifests first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies (including production native compilation)
RUN npm ci --only=production

# Copy entire application source tree
COPY . .

# Build frontend production bundle (outputs to frontend/dist)
RUN npm run build

# Create directory for persistent SQLite storage
RUN mkdir -p /app/backend/data && chmod -R 777 /app/backend/data

# Expose unified application port
EXPOSE 3000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start unified production server
CMD ["node", "backend/server.js"]
