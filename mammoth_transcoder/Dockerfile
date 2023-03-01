FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY lib ./lib
COPY utility.js ./
COPY upload.html ./
COPY index.js ./

EXPOSE 3000

CMD ["npm", "start"]