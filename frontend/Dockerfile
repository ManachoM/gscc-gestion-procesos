# Development image — uses Vite dev server with HMR
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Source is mounted at runtime via docker-compose volume
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
