#!/bin/sh
# Backup Agent Entrypoint Script

echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║         🛡️  IMMUTABLE BACKUP AGENT v1.0 🛡️            ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Configuration:"
echo "   Database:  ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "   User:      ${DB_USER}"
echo "   Schedule:  ${BACKUP_SCHEDULE}"
echo "   Retention: ${BACKUP_RETENTION_DAYS} days"
echo ""

# Create cron jobs
CRON_FILE=/etc/crontabs/root
mkdir -p /etc/crontabs

echo "⏰ Setting up backup schedule..."
echo "${BACKUP_SCHEDULE} /usr/local/bin/backup.py hourly >> /backups/logs/cron.log 2>&1" > $CRON_FILE
echo "0 0 * * * /usr/local/bin/backup.py daily >> /backups/logs/cron.log 2>&1" >> $CRON_FILE
echo "0 0 * * 0 /usr/local/bin/backup.py weekly >> /backups/logs/cron.log 2>&1" >> $CRON_FILE

# Set proper permissions
chmod 0600 $CRON_FILE

echo "   ✅ Hourly:  Every hour at minute 0"
echo "   ✅ Daily:   Every day at 00:00 UTC"
echo "   ✅ Weekly:  Every Sunday at 00:00 UTC"
echo ""

# Wait for database to be ready
echo "🔄 Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    PGPASSWORD=$(cat /run/secrets/db_password) pg_isready -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "   ✅ Database is ready"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   ⏳ Attempt $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "   ❌ Database not ready after $MAX_RETRIES attempts"
    echo "   ⚠️  Starting anyway, backups will retry..."
fi

echo ""
echo "📦 Creating initial backup..."
/usr/local/bin/backup.py daily

echo ""
echo "🚀 Starting cron scheduler..."
echo "   Logs: /backups/logs/cron.log"
echo ""

# Start cron in foreground
exec crond -f -l 2
