FROM python:3.11-alpine

# Install required packages
RUN apk add --no-cache \
    e2fsprogs \
    tzdata

# Set timezone to UTC
ENV TZ=UTC

# Copy extractor script
COPY extractor.py /usr/local/bin/extractor.py

RUN chmod +x /usr/local/bin/extractor.py

# Create directories
RUN mkdir -p /backups/extracted /external

# Health check
HEALTHCHECK --interval=5m --timeout=10s --start-period=10s --retries=3 \
    CMD test -f /backups/logs/extraction_audit.jsonl || exit 1

WORKDIR /backups

CMD ["/usr/local/bin/extractor.py"]
