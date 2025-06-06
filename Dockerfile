# Dockerfile

# Stage 1: Build the Next.js application
FROM node:20-alpine AS builder
WORKDIR /app

# Definir ARG para NODE_ENV para que seja usado durante npm install se necessário
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Copiar package.json e package-lock.json (ou yarn.lock, pnpm-lock.yaml)
COPY package.json package-lock.json* ./

# Instalar dependências.
# Para builds de produção, `npm ci` é geralmente preferido se package-lock.json está atualizado.
# Se o build precisa de devDependencies (como o `next` para `next build`), instale todas.
RUN npm install

# Copiar o restante do código fonte da aplicação
COPY . .

# Construir a aplicação Next.js
# A opção `output: 'standalone'` no next.config.js garante
# que um servidor mínimo seja construído no diretório .next/standalone
RUN npm run build

# Stage 2: Production image (Runner)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
# O servidor Next.js no modo standalone escuta na porta 3000 por padrão.
# Você pode sobrescrever isso com a variável de ambiente PORT.
# ENV PORT 3000

# Copiar a saída standalone do estágio builder
# Isso inclui server.js, .next/static, public, e node_modules mínimos
COPY --from=builder /app/.next/standalone ./

# Expor a porta em que a aplicação roda
EXPOSE 3000

# Opcional: Desabilitar telemetria do Next.js
ENV NEXT_TELEMETRY_DISABLED 1

# Comando para rodar a aplicação
# O arquivo server.js é criado pela saída standalone
CMD ["node", "server.js"]
