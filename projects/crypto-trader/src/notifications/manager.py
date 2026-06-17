from __future__ import annotations

from src.config import NotificationsConfig
from src.notifications.base import Notifier
from src.notifications.discord import DiscordNotifier
from src.notifications.telegram import TelegramNotifier
from src.portfolio.tracker import TradeRecord
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


class NotificationManager:
    def __init__(self, config: NotificationsConfig) -> None:
        self.config = config
        self._notifiers: list[Notifier] = []
        if config.enabled and config.telegram and config.telegram_bot_token and config.telegram_chat_id:
            self._notifiers.append(
                TelegramNotifier(config.telegram_bot_token, config.telegram_chat_id)
            )
        if config.enabled and config.discord and config.discord_webhook_url:
            self._notifiers.append(DiscordNotifier(config.discord_webhook_url))

    @property
    def active_channels(self) -> list[str]:
        return [n.name for n in self._notifiers]

    def notify_trade(self, trade: TradeRecord) -> None:
        if not self.config.enabled or not self._notifiers:
            return
        if self.config.notify_modes and trade.mode not in self.config.notify_modes:
            return
        for notifier in self._notifiers:
            try:
                ok = notifier.notify_trade(trade)
                if ok:
                    logger.info("Trade notification sent via %s", notifier.name)
                else:
                    logger.warning("Trade notification failed via %s", notifier.name)
            except Exception:
                logger.exception("Unexpected notification error via %s", notifier.name)
