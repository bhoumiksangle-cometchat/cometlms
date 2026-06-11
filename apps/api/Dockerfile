FROM node:20 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20 AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
# API listens on HTTP. Public URL configuration is provided via environment variables.
CMD ["npm","run","start"]