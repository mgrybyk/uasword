FROM tarampampam/node:16-alpine

WORKDIR /app
COPY . ./

RUN npm install

CMD ["node", "index"]
