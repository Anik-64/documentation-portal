FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev 
COPY . .

FROM node:20-alpine 
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=builder /app/views ./views
COPY --from=builder /app/.env.example ./
COPY --from=builder /app/db.js ./
COPY --from=builder /app/index.js ./

EXPOSE 8080

ENTRYPOINT ["npm", "run"]
CMD ["start"]