from __future__ import annotations

import time
from pathlib import Path

import pandas as pd
import streamlit as st

from src.dashboard.portfolio_io import load_portfolio_snapshot


st.set_page_config(page_title="Crypto Trader Dashboard", layout="wide")
st.title("Crypto Trader Dashboard")

ROOT = Path(__file__).resolve().parents[1]
PAPER_PATH = ROOT / "data" / "paper_portfolio.json"
LIVE_PATH = ROOT / "data" / "live_portfolio.json"

st.sidebar.header("Portfolio")
portfolio_choice = st.sidebar.radio(
    "Choose snapshot",
    options=["paper", "live"],
    index=0,
    format_func=lambda x: x.upper(),
)
path = PAPER_PATH if portfolio_choice == "paper" else LIVE_PATH

st.sidebar.write(f"Source: `{path}`")

refresh_seconds = st.sidebar.slider("Auto refresh seconds", min_value=5, max_value=60, value=15)
auto_refresh = st.sidebar.checkbox("Auto refresh", value=True)

if auto_refresh:
    st.sidebar.info("This page will reload periodically.")


@st.cache_data(ttl=5)
def _load():
    return load_portfolio_snapshot(path)


snap = _load()

col_a, col_b, col_c = st.columns([1, 1, 1])
col_a.metric("Cash", f"{snap.cash:,.2f}")
col_b.metric("Open positions", f"{len(snap.positions)}")
col_c.metric("Trades (last)", f"{len(snap.trades)}")

st.subheader("Equity curve")
if not snap.equity_history:
    st.info("No equity history yet. Run paper trading for a bit (paper mode) or use the backtest offline run.")
else:
    df = pd.DataFrame(snap.equity_history)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp")
    st.line_chart(df.set_index("timestamp")["equity"])

st.subheader("Open positions")
if not snap.positions:
    st.write("No open positions.")
else:
    rows = []
    for sym, pos in snap.positions.items():
        rows.append(
            {
                "symbol": sym,
                "amount": pos.get("amount"),
                "entry_price": pos.get("entry_price"),
                "entry_value": pos.get("entry_value"),
            }
        )
    st.dataframe(pd.DataFrame(rows))

st.subheader("Recent trades")
if not snap.trades:
    st.write("No trades in snapshot.")
else:
    trades = snap.trades[-10:]
    st.dataframe(pd.DataFrame(trades))

if auto_refresh:
    time.sleep(refresh_seconds)
    st.rerun()

