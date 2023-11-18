FROM node:18 AS deps

WORKDIR /app

COPY package*.json ./
RUN npm install

FROM node:lts-alpine AS builder

WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules



CMD ["sh", "-c", "node notification.mjs"]