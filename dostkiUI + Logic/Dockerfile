# Use official Node.js 20 LTS image
FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# Install system dependencies (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set Node environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests first for optimal Docker layer caching
COPY package*.json ./

# Install dependencies with robust network timeout and retry flags
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm install --omit=dev --no-audit --no-fund

# Copy application source code and assets
COPY src/ ./src/
COPY public/ ./public/

# Ensure upload directory exists with proper permissions
RUN mkdir -p uploads && chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose HTTP port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the server
CMD ["node", "src/server.js"]
