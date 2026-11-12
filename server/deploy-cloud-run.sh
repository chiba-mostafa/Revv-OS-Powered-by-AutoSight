#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT_ID:-}}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-autosight-server}"
ENV_FILE="${ENV_FILE:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Error: set PROJECT_ID or GOOGLE_CLOUD_PROJECT_ID before deploying." >&2
  exit 1
fi

DEPLOY_CMD=(
  gcloud run deploy "${SERVICE_NAME}"
  --source "${SCRIPT_DIR}"
  --project "${PROJECT_ID}"
  --region "${REGION}"
  --platform managed
  --allow-unauthenticated
)

if [[ -n "${ENV_FILE}" ]]; then
  DEPLOY_CMD+=(--env-vars-file "${ENV_FILE}")
fi

echo "Deploying ${SERVICE_NAME} to Cloud Run"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"

"${DEPLOY_CMD[@]}"
