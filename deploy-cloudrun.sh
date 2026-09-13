#!/bin/bash
# ==============================================================================
# KisanDirect AI - Google Cloud Run One-Command Container Deployment
# ==============================================================================

set -e

# Configuration Defaults (Override via environment if desired)
PROJECT_ID=${GCP_PROJECT_ID:-"$(gcloud config get-value project 2>/dev/null)"}
SERVICE_NAME=${SERVICE_NAME:-"kisandirect-ai"}
REGION=${GCP_REGION:-"asia-south1"} # Mumbai region for minimal latency to Indian farmgate grid
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo "=================================================================="
echo "🚀 Deploying KisanDirect AI Unified Application to Cloud Run"
echo "Project:  ${PROJECT_ID}"
echo "Service:  ${SERVICE_NAME}"
echo "Region:   ${REGION}"
echo "Image:    ${IMAGE_NAME}"
echo "=================================================================="

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: GCP_PROJECT_ID is not set and no default gcloud project found."
  echo "Run: gcloud config set project <your-project-id> or export GCP_PROJECT_ID=<your-project-id>"
  exit 1
fi

echo "📦 Step 1: Building container image via Google Cloud Build..."
gcloud builds submit --tag "$IMAGE_NAME" .

echo "☁️ Step 2: Deploying container to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars="NODE_ENV=production,HOST=0.0.0.0,ADMIN_EMAIL=owner@kisandirect.com"

echo "✅ KisanDirect AI successfully deployed!"
gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --format 'value(status.url)'
