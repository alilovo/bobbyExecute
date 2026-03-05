# M10: Production Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY bot/package*.json bot/
RUN cd bot && npm ci --omit=dev
COPY bot/ bot/
RUN cd bot && npm run build
ENV NODE_ENV=production
CMD ["node", "--version"]
