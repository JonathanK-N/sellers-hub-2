FROM node:18-slim

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install

COPY . .
RUN yarn build

RUN npm install -g serve

CMD serve -s build -l ${PORT:-3000}
