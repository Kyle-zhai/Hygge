FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY worker/package.json worker/package-lock.json* ./

# Install dependencies
RUN npm install

# Copy worker source
COPY worker/tsconfig.json ./
COPY worker/src/ ./src/

# Build TypeScript
RUN npx tsc

# --- Production stage ---
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/dist/ ./dist/

# Copy persona data
COPY worker/data/ ./data/

CMD ["node", "dist/index.js"]
