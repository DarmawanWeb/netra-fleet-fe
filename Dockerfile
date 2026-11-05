FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY . .
RUN npm run postinstall && npm run build

# The dashboard is static: netra serves it itself; this image serves it alone (port 3000).
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/out /srv
EXPOSE 3000
