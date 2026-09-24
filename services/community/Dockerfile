FROM node:22-alpine AS dependencies
WORKDIR /srv/community
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /srv/community
COPY --from=dependencies /srv/community/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
RUN mkdir -p /data/blobs && chown -R node:node /data/blobs /srv/community
USER node
EXPOSE 8787
CMD ["node", "src/server.mjs"]
