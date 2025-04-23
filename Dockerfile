FROM node:20-alpine AS base
WORKDIR /home/ndns

COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 53/udp

CMD ["node", "/home/ndns/index.mjs"]