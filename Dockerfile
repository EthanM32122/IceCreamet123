FROM node:20-bookworm-slim

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json ./

# Install ALL deps including build tools (vite lives in dependencies)
RUN npm install --include=dev --no-audit --no-fund

# Copy the rest of the repo
COPY . .

# Build: assemble src/ then vite production build
RUN node scripts/prepare-src.mjs
RUN npx vite build

# Runtime
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
