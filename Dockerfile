FROM node:20-bookworm-slim

WORKDIR /app

# Dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm install --include=dev --no-audit --no-fund

# App source
COPY . .

# Assemble src/ then production Vite build
RUN node scripts/prepare-src.mjs && npx vite build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
