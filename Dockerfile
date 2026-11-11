# ---------- build the web UI ----------
FROM node:22-bookworm-slim AS webbuild
WORKDIR /app
COPY web/package*.json ./web/
RUN cd web && npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000
COPY web ./web
RUN cd web && npm run build

# ---------- runtime ----------
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates ffmpeg \
 && rm -rf /var/lib/apt/lists/* \
 && pip3 install --break-system-packages --no-cache-dir -U "yt-dlp" \
 && yt-dlp --version

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    PYTHONUNBUFFERED=1

# server dependencies (express, youtubei.js)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000

# built web UI + the node server
COPY --from=webbuild /app/web/dist ./web/dist
COPY server ./server

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=8s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
