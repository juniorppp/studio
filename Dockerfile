# Dockerfile

# 1. Builder Stage: Install dependencies and build the Next.js app
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package.json and lock files
COPY package.json ./
# Ensure package-lock.json is also copied if it exists and is used
COPY package-lock.json* ./
# If you use yarn, copy yarn.lock instead
# COPY yarn.lock ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Set NEXT_TELEMETRY_DISABLED to 1 to disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# Build the Next.js app
RUN npm run build

# 2. Runner Stage: Create the final production image
FROM node:18-alpine AS runner
WORKDIR /app

# Set NEXT_TELEMETRY_DISABLED to 1 to disable telemetry in production
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
# Explicitly set HOST and PORT for the Next.js server inside the container
ENV HOST 0.0.0.0
ENV PORT 3000

# Copy the standalone output from the builder stage.
# This includes .next/static, public (within .next/standalone), server.js, and minimal node_modules.
COPY --from=builder /app/.next/standalone ./
# The 'public' directory from the project root is included in '.next/standalone/public' by the build.
# So, the above COPY command handles it. The separate copy of 'public' is removed.

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
# The server.js file is expected to be at the root of the WORKDIR (/app)
# because we copied the contents of .next/standalone directly into /app
CMD ["node", "server.js"]
