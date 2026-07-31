FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --cache /tmp/npm-cache --legacy-peer-deps
COPY . .
RUN ./node_modules/.bin/prisma generate
RUN npm run build
EXPOSE 3000
COPY start.sh ./
RUN chmod +x start.sh
CMD ["./start.sh"]
