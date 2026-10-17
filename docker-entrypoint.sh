#!/bin/sh
set -e

echo "============================================================"
echo " Starting Bangalore Real Estate Portal (DPDP Act 2023)"
echo " Environment: ${NODE_ENV:-production}"
echo "============================================================"

if [ -z "$DATABASE_URL" ]; then
  echo "=> DATABASE_URL is required for the PostgreSQL-backed application."
  exit 1
fi

echo "=> PostgreSQL schema will be initialized by the application."

echo "=> Launching Next.js production server on port ${PORT:-3000}..."
exec node server.js

