#!/usr/bin/env python3
"""測試 Telegram / Discord 成交通知。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rich.console import Console

from src.config import load_config
from src.notifications import NotificationManager
from src.portfolio.tracker import TradeRecord

console = Console()


def main() -> None:
    parser = argparse.ArgumentParser(description="Send a test trade notification")
    parser.add_argument("--config", default=None)
    args = parser.parse_args()

    config = load_config(args.config)
    config.notifications.enabled = True
    manager = NotificationManager(config.notifications)

    if not manager.active_channels:
        console.print("[red]No notification channels configured.[/red]")
        console.print("Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID or DISCORD_WEBHOOK_URL in .env")
        sys.exit(1)

    trade = TradeRecord(
        timestamp="2026-06-17T07:40:00+00:00",
        symbol="BTC/USDT",
        side="buy",
        amount=0.0015,
        price=65000.0,
        value=97.5,
        fee=0.0975,
        reason="test notification",
        mode="paper",
    )
    manager.notify_trade(trade)
    console.print(f"[green]Test notification sent via: {', '.join(manager.active_channels)}[/green]")


if __name__ == "__main__":
    main()
