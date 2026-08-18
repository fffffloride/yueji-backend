FROM node:20-alpine AS build-stage

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm config set registry https://registry.npmmirror.com/

RUN npm install -g pnpm@9

RUN pnpm config set registry https://registry.npmmirror.com/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# production stage
FROM node:20-alpine AS production-stage

COPY --from=build-stage /app/dist /app
COPY --from=build-stage /app/package.json /app/package.json
COPY --from=build-stage /app/pnpm-lock.yaml /app/pnpm-lock.yaml

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com/

RUN npm install -g pnpm@9

RUN pnpm config set registry https://registry.npmmirror.com/

RUN pnpm install --prod --frozen-lockfile

# 应用对外暴露端口（与 SERVER_PORT 保持一致）
EXPOSE 8000

CMD ["node", "/app/main.js"]
