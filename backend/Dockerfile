FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --cache /tmp/npm-cache --legacy-peer-deps
COPY . .
RUN npx prisma generate

FROM base AS development
CMD ["npm", "run", "dev"]

FROM base AS builder
RUN npm run build || true

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --only=production --cache /tmp/npm-cache --legacy-peer-deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/index.js"]
