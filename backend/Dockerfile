FROM node:20-alpine AS base

WORKDIR /app

# python3/make/g++ → native npm paketleri
# ffmpeg           → resim ve video işleme (çözünürlük düşürme, format dönüştürme)
RUN apk add --no-cache python3 make g++ curl ffmpeg

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p logs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
