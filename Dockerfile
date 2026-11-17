FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# better-sqlite3 is native, so install with build tooling available, then drop it.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
 && npm ci --omit=dev \
 && apt-get purge -y python3 make g++ && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY public ./public
# Mount a volume here on your host, or the database dies with the container.
VOLUME /app/data
ENV DATABASE_PATH=/app/data/haulmath.db
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
