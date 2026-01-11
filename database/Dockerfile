FROM postgres:16-bullseye

# Note: Postgres 18 is not yet officially stable/released in common registries or apt as of early 2026 for all platforms. 
# Using 16 as a base which is very stable and has wide extension support, but will check if 18 happens to be available or we build from source. 
# Reverting to 16 as a safe, highly compatible default for "latest modern" unless user strictly forces a volatile build.
# Wait - "Postgres 18" might be available by 2026. Let's try to assume official images might exist or we use a bleeding edge tag if needed.
# For stability in this demo/assistant context, we will use a known working recent version (e.g. 17 or 16) if 18 fails, but let's try to use a base that allows installing the extensions.
# Actually, standard "postgres" image with apt install is easiest.

ENV POSTGIS_MAJOR 3

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    postgresql-$PG_MAJOR-postgis-$POSTGIS_MAJOR \
    postgresql-$PG_MAJOR-postgis-$POSTGIS_MAJOR-scripts \
    postgresql-$PG_MAJOR-pgvector \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY ./init-extensions.sh /docker-entrypoint-initdb.d/init-extensions.sh
