FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY tsconfig.json ./
COPY *.ts ./

RUN npx tsc

EXPOSE 8080

CMD ["node", "dist/bridge.js"]
