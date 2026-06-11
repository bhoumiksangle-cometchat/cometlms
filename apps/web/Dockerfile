FROM node:20 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20 AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
# Served over HTTP by the container runtime/reverse proxy configuration.
CMD ["npm","run","preview","--","--host","0.0.0.0"]