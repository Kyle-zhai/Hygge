FROM node:20-slim AS builder

WORKDIR /app

# Copy shared types
COPY shared/ ./shared/

# Copy worker package files
COPY worker/package.json worker/package-lock.json* ./worker/

# Install dependencies
WORKDIR /app/worker
RUN npm install

# Copy worker source
COPY worker/tsconfig.json ./
COPY worker/src/ ./src/

# Build TypeScript
RUN npx tsc

# --- Production stage ---
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/worker/package.json ./
COPY --from=builder /app/worker/node_modules/ ./node_modules/
COPY --from=builder /app/worker/dist/ ./dist/
COPY --from=builder /app/shared/ ./shared/

# Copy persona data
COPY worker/data/ ./data/

CMD ["node", "dist/index.js"]
