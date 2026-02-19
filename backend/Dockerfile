# =============================================================================
# Stage 1: cargo-chef installer
# Installs cargo-chef which enables dependency-layer caching for Rust builds.
# This stage only runs once and is cached indefinitely.
# =============================================================================
FROM rust:1.75-slim AS chef
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*
# cargo-chef: dependency-layer caching for Rust builds
# cargo-watch: file-watcher for hot reload in dev mode (baked in here so the
#              dev container never needs to compile it at startup)
RUN cargo install cargo-chef cargo-watch --locked
WORKDIR /app

# =============================================================================
# Stage 2: planner
# Analyses the dependency tree and produces a recipe.json file.
# This only changes when Cargo.toml / Cargo.lock change — not on source edits.
# =============================================================================
FROM chef AS planner
COPY Cargo.toml Cargo.lock* ./
# Create a stub main.rs so cargo-chef can resolve the full dep graph
RUN mkdir -p src && echo 'fn main() {}' > src/main.rs
RUN cargo chef prepare --recipe-path recipe.json

# =============================================================================
# Stage 3: builder
# 1. Cooks (compiles) all dependencies from recipe.json — layer is cached until
#    Cargo.toml / Cargo.lock change.
# 2. Copies real source and does the final incremental build.
# =============================================================================
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies only — this layer is cached
RUN cargo chef cook --release --recipe-path recipe.json
# Copy full source and do final build
COPY . .
RUN cargo build --release --bin settleone-backend

# =============================================================================
# Stage 4: runtime
# Minimal Debian image — only the compiled binary + TLS certs.
# ca-certificates is required so reqwest can make HTTPS calls to:
#   - ensdata.net  (ENS resolution)
#   - li.quest     (LI.FI cross-chain quotes)
# =============================================================================
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN useradd --system --no-create-home --uid 1001 settleone
USER settleone

WORKDIR /app
COPY --from=builder /app/target/release/settleone-backend ./settleone-backend

# Default environment — all overridable at runtime via docker compose or -e flags
ENV PORT=3001
ENV RUST_LOG=settleone_backend=info,tower_http=info
ENV ETH_RPC_URL=https://eth.llamarpc.com
ENV ARC_RPC_URL=https://rpc.arc.circle.com
ENV LIFI_API_URL=https://li.quest/v1

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["./settleone-backend"]
