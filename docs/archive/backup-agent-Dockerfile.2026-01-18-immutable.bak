FROM postgres:16-alpine

# Install required packages
RUN apk add --no-cache \
    python3 \
    e2fsprogs \
    tzdata

# Set timezone to UTC
ENV TZ=UTC

# Copy scripts
COPY backup.py /usr/local/bin/backup.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/backup.py /usr/local/bin/entrypoint.sh

# Create backup directories with proper permissions
RUN mkdir -p /backups/staging /backups/active /backups/logs && \
    chmod 700 /backups/staging && \
    chmod 500 /backups/active && \
    chmod 755 /backups/logs

# Health check
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
    CMD test -f /backups/logs/backup_audit.jsonl || exit 1

WORKDIR /backups

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
