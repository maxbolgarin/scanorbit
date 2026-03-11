#!/bin/sh
# Alertmanager entrypoint - substitutes env vars in config template

sed \
  -e "s#\${SLACK_WEBHOOK_URL}#${SLACK_WEBHOOK_URL:-}#g" \
  -e "s#\${TELEGRAM_BOT_TOKEN}#${TELEGRAM_BOT_TOKEN:-}#g" \
  -e "s#\${TELEGRAM_CHAT_ID}#${TELEGRAM_CHAT_ID:-0}#g" \
  -e "s#\${TELEGRAM_THREAD_ID}#${TELEGRAM_THREAD_ID:-0}#g" \
  /etc/alertmanager/alertmanager.yml.tmpl > /etc/alertmanager/alertmanager.yml

exec /bin/alertmanager --config.file=/etc/alertmanager/alertmanager.yml --storage.path=/alertmanager "$@"
