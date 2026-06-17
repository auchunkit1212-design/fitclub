#!/bin/sh
set -eu

MODE="${1:-paper}"
shift || true

case "$MODE" in
  paper)
    exec python scripts/run_paper.py "$@"
    ;;
  live)
    exec python scripts/run_live.py --confirm-live "$@"
    ;;
  backtest)
    exec python scripts/run_backtest.py "$@"
    ;;
  dashboard)
    exec streamlit run dashboard/app.py \
      --server.port="${STREAMLIT_PORT:-8501}" \
      --server.address=0.0.0.0 \
      --browser.gatherUsageStats=false \
      "$@"
    ;;
  cache)
    exec python scripts/cache_ohlcv.py "$@"
    ;;
  status)
    exec python scripts/status.py "$@"
    ;;
  *)
    exec "$MODE" "$@"
    ;;
esac
