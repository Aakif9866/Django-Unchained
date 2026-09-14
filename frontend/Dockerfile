# --- Build stage: compile the Vite app to static files ---
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Vite bakes VITE_* vars into the JS bundle at BUILD time, not runtime —
# unlike the backend's env vars, this can't be changed by just editing
# docker-compose.yml and restarting the container; the image must be
# rebuilt. Empty string (not unset) means "same origin" — see client.js.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- Runtime stage: nginx serves the static build AND proxies /api to
# the backend — this one container is the "Nginx" box in the project's
# target architecture diagram. ---
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
