# Static build, served by nginx. Works on Coolify, Fly, Railway, plain Docker.
#
#   docker build -t the-long-night . && docker run -p 8080:80 the-long-night
#
# The build stage needs Node 22.18+ for native TypeScript type stripping; the
# runtime stage needs no Node at all, because the output is just files.

FROM node:22-alpine AS build
WORKDIR /app

# Only the dev dependency (typescript) is ever installed; the game ships zero
# runtime dependencies, so this layer is small and caches well.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.web.json ./
COPY src ./src
COPY web ./web
COPY assets ./assets
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/ >/dev/null || exit 1
