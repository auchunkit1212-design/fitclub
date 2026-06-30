from unittest.mock import MagicMock, patch

from src.config import NotificationsConfig
from src.notifications.base import format_trade_message
from src.notifications.discord import DiscordNotifier
from src.notifications.manager import NotificationManager
from src.notifications.telegram import TelegramNotifier
from src.portfolio.tracker import TradeRecord


def _sample_trade() -> TradeRecord:
    return TradeRecord(
        timestamp="2026-06-17T07:40:00+00:00",
        symbol="BTC/USDT",
        side="buy",
        amount=0.01,
        price=50000,
        value=500,
        fee=0.5,
        reason="test",
        mode="paper",
    )


def test_format_trade_message_contains_key_fields():
    message = format_trade_message(_sample_trade())
    assert "BTC/USDT" in message
    assert "買入" in message
    assert "PAPER" in message


@patch("src.notifications.telegram.urllib.request.urlopen")
def test_telegram_notifier_send(mock_urlopen):
    mock_response = MagicMock()
    mock_response.read.return_value = b'{"ok": true}'
    mock_response.__enter__.return_value = mock_response
    mock_urlopen.return_value = mock_response

    notifier = TelegramNotifier("token123", "chat456")
    assert notifier.send("hello") is True


@patch("src.notifications.discord.urllib.request.urlopen")
def test_discord_notifier_send(mock_urlopen):
    mock_response = MagicMock()
    mock_response.status = 204
    mock_response.__enter__.return_value = mock_response
    mock_urlopen.return_value = mock_response

    notifier = DiscordNotifier("https://discord.com/api/webhooks/test")
    assert notifier.send("hello") is True


def test_notification_manager_skips_backtest_mode():
    config = NotificationsConfig(
        enabled=True,
        telegram=True,
        telegram_bot_token="token",
        telegram_chat_id="chat",
        notify_modes=["paper", "live"],
    )
    manager = NotificationManager(config)
    trade = _sample_trade()
    trade.mode = "backtest"
    manager._notifiers = [MagicMock()]
    manager.notify_trade(trade)
    manager._notifiers[0].notify_trade.assert_not_called()
