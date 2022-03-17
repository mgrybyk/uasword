FROM mcr.microsoft.com/playwright:v1.20.0-focal

WORKDIR /app
COPY . ./

RUN npm install

CMD ["node", "index"]
