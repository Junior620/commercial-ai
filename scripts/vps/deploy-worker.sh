#!/usr/bin/env bash
# Met à jour le service de lecture des sites sur le VPS.
#
#   bash scripts/vps/deploy-worker.sh           # empaquette, envoie, reconstruit, redémarre
#   bash scripts/vps/deploy-worker.sh --check   # état du service, sans rien modifier
#
# Réglages lus dans .env.deploy (non commité) :
#   DEPLOY_VPS_HOST=169.58.99.28
#   DEPLOY_VPS_USER=root
#   DEPLOY_VPS_SSH_KEY=C:/Users/.../.ssh/id_ed25519
#   DEPLOY_VPS_PATH=/opt/scpb-scraper          (facultatif)
#
# Ne touche qu'à /opt/scpb-scraper. Le fichier .env du serveur n'est jamais écrasé.
set -euo pipefail

cd "$(dirname "$0")/../.."
[ -f .env.deploy ] || { echo "Fichier .env.deploy manquant (voir l'en-tête de ce script)."; exit 1; }
set -a; . ./.env.deploy; set +a

HOST="${DEPLOY_VPS_HOST:?DEPLOY_VPS_HOST manquant}"
USER_NAME="${DEPLOY_VPS_USER:-root}"
KEY="${DEPLOY_VPS_SSH_KEY:?DEPLOY_VPS_SSH_KEY manquant}"
REMOTE="${DEPLOY_VPS_PATH:-/opt/scpb-scraper}"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$USER_NAME@$HOST")

if [ "${1:-}" = "--check" ]; then
  "${SSH[@]}" "cd '$REMOTE' 2>/dev/null && docker compose ps && curl -s http://127.0.0.1:8090/health; echo; docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' scpb-scraper-worker-1 2>/dev/null || true"
  exit 0
fi

echo "1/4 Empaquetage du service"
pnpm worker:build

echo "2/4 Envoi vers $HOST:$REMOTE"
"${SSH[@]}" "mkdir -p '$REMOTE/worker/dist'"
tar -czf - -C worker Dockerfile package.json dist/server.mjs | "${SSH[@]}" "tar -xzf - -C '$REMOTE/worker'"
tar -czf - -C deploy/vps docker-compose.yml | "${SSH[@]}" "tar -xzf - -C '$REMOTE'"

echo "3/4 Construction et redémarrage"
"${SSH[@]}" "cd '$REMOTE' && [ -f .env ] || { echo 'Fichier .env absent sur le serveur : créez-le depuis deploy/vps/env.example'; exit 1; } && chmod 600 .env && docker compose up -d --build"

echo "4/4 Contrôle"
"${SSH[@]}" "for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf http://127.0.0.1:8090/health && break; sleep 2; done; echo; docker compose -f '$REMOTE/docker-compose.yml' ps --format '{{.Name}} {{.Status}}'"
