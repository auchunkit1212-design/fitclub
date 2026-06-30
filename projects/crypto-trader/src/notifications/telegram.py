from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from src.notifications.base import Notifier
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


class TelegramNotifier(Notifier):
    name = "telegram"

    def __init__(self, bot_token: str, chat_id: str) -> None:
        self.bot_token = bot_token.strip()
        self.chat_id = chat_id.strip()

    def send(self, message: str) -> bool:
        if not self.bot_token or not self.chat_id:
            logger.warning("Telegram notifier skipped: missing bot token or chat id")
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = urllib.parse.urlencode(
            {
                "chat_id": self.chat_id,
                "text": message,
                "disable_web_page_preview": "true",
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                body = json.loads(response.read().decode("utf-8"))
            if not body.get("ok"):
                logger.error("Telegram API error: %s", body)
                return False
            return True
        except urllib.error.URLError as exc:
            logger.error("Telegram send failed: %s", exc)
            return False
