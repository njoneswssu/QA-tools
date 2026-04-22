# Build context must be this folder (citi-active-merchants-dashboard), e.g.:
#   cd citi-active-merchants-dashboard && docker compose build

FROM node:20-alpine

WORKDIR /app

# 1) Manifest — Docker caches this layer until dependencies change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2) Application source copied explicitly into the image
COPY server.js ./
COPY lib ./lib
COPY public ./public

# 3) Run as non-root
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 3950

CMD ["node", "server.js"]
