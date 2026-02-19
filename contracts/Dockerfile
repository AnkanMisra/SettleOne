# =============================================================================
# Contracts — Hardhat Development Environment
#
# This is NOT a long-running service. It provides the Hardhat toolchain
# for compiling contracts, running tests, and optionally starting a local
# Hardhat node that the frontend can connect to for fully local development.
#
# Usage (via docker compose):
#   Compile:         docker compose --profile contracts run --rm contracts pnpm compile
#   Test:            docker compose --profile contracts run --rm contracts pnpm test
#   Local node:      docker compose --profile contracts run --rm --service-ports contracts npx hardhat node
#   Deploy local:    docker compose --profile contracts run --rm contracts pnpm deploy:local
#   Deploy testnet:  docker compose --profile contracts run --rm contracts pnpm deploy:base-sepolia
# =============================================================================
FROM node:20-alpine AS contracts

RUN corepack enable && corepack prepare pnpm@latest --activate

# Build tools needed for native node modules (e.g. secp256k1)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (cached until package.json / pnpm-lock.yaml change)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy contract source
COPY . .

# Compile contracts at image build time so the image is ready to use immediately.
# Artifacts are stored in /app/artifacts (inside the container).
RUN pnpm compile

# Hardhat local node port
EXPOSE 8545

# Default command: run the test suite.
# Override at runtime with `docker compose run contracts <command>`.
CMD ["pnpm", "test"]
