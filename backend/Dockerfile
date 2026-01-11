FROM debian:bookworm-slim AS builder
WORKDIR /usr/src/backend

# Install build dependencies and rustup (use nightly toolchain to support edition2024)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl build-essential ca-certificates pkg-config libssl-dev git && \
    rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

# Install rustup and set nightly as default to support newer Cargo features
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain nightly && \
    rustup --version && cargo --version

# Copy project files
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
COPY data ./data
COPY config ./config
COPY keys ./keys

# Build release binary
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy binary and data from builder
COPY --from=builder /usr/src/backend/target/release/template-repo-backend /usr/local/bin/template-repo-backend
COPY --from=builder /usr/src/backend/data ./data
COPY --from=builder /usr/src/backend/config ./config
COPY --from=builder /usr/src/backend/keys ./keys

EXPOSE 3000
ENV RUST_LOG=info
CMD ["template-repo-backend"]


