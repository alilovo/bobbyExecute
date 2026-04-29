# BobbyExecute bot image
FROM node:22-alpine AS build
WORKDIR /app

COPY bot/package*.json ./bot/
RUN cd bot && npm ci

COPY bot/ ./bot/
RUN cd bot && npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3333

COPY --from=build /app/bot/package*.json ./bot/
COPY --from=build /app/bot/node_modules ./bot/node_modules
COPY --from=build /app/bot/dist ./bot/dist
COPY --from=build /app/bot/openapi.yaml ./bot/openapi.yaml
COPY --from=build /app/bot/migrations    ./bot/migrations
EXPOSE 3333

CMD ["node", "bot/dist/server/run.js"]
