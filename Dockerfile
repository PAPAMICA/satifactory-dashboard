# Build web + API, run single Node process (API + static SPA)
FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm install

COPY apps/api apps/api
COPY apps/web apps/web
COPY package.json ./

RUN npm run build

FROM node:22-bookworm
WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV NODE_OPTIONS=--experimental-sqlite
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/web/dist ./public

EXPOSE 3000
CMD ["node", "dist/index.js"]
