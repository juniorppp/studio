
# ===== Builder Stage =====
FROM node:18-alpine AS builder
WORKDIR /app

# Copiar package.json e package-lock.json (ou yarn.lock)
COPY package*.json ./

# Instalar dependências de produção primeiro se você tiver um lockfile robusto
# RUN npm ci --only=production
# Ou instalar todas as dependências se necessário para o build
RUN npm install

# Copiar o restante dos arquivos da aplicação
COPY . .

# Rodar o script de build (Next.js irá detectar output: 'standalone')
RUN npm run build

# ===== Runner Stage =====
FROM node:18-alpine AS runner
WORKDIR /app

# Definir explicitamente HOST e PORT para o servidor Next.js
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

# Copiar o diretório .next/standalone da build
COPY --from=builder /app/.next/standalone ./

# Copiar o diretório public para dentro do standalone (se houver assets estáticos)
# O output standalone já inclui o public se ele existir na raiz do projeto.
# Se você tiver o public e ele não estiver sendo incluído, pode adicionar:
# COPY --from=builder /app/public ./public
# No entanto, com output: 'standalone', o Next.js deve lidar com isso,
# e a cópia de .next/standalone já contém a pasta public (se ela existir na raiz).

# Expor a porta que o app Next.js irá rodar (padrão 3000)
EXPOSE 3000

# Comando para iniciar a aplicação (o server.js é gerado pelo build standalone)
CMD ["node", "server.js"]
