FROM mcr.microsoft.com/playwright:v1.20.0-focal

WORKDIR /app
COPY . ./

ENV IS_DOCKER=true

RUN npm install --omit dev --no-fund --no-audit

CMD ["node", "index"]
