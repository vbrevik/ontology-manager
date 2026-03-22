FROM node:20-bullseye

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5373
CMD ["pnpm", "exec", "vite", "--host", "0.0.0.0", "--port", "5373"]
