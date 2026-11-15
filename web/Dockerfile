FROM node:20-alpine AS build
WORKDIR /app
COPY web/package*.json ./
RUN npm install --no-audit --no-fund
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY web ./
RUN npm run build

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
