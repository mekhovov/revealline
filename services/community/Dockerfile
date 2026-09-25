FROM node:22-alpine AS dependencies
WORKDIR /srv/community
COPY services/community/package.json services/community/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /srv/community
RUN apk add --no-cache ffmpeg postgresql17-client
COPY --from=dependencies /srv/community/node_modules ./node_modules
COPY services/community/package.json ./
COPY services/community/src ./src
COPY services/community/migrations ./migrations
COPY game /srv/game
RUN mkdir -p /data/blobs /data/tus /data/recovery \
  && chown -R node:node /data/blobs /data/tus /data/recovery /srv/community
USER node
EXPOSE 8787
CMD ["node", "src/server.mjs"]
