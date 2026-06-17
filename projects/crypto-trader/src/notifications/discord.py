from __future__ import annotations

import json
import urllib.error
import urllib.request

from src.notifications.base import Notifier
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


class DiscordNotifier(Notifier):
    name = "discord"

    def __init__(self, webhook_url: str) -> None:
        self.webhook_url = webhook_url.strip()

    def send(self, message: str) -> bool:
        if not self.webhook_url:
            logger.warning("Discord notifier skipped: missing webhook url")
            return False

        payload = json.dumps({"content": message}).encode("utf-8")
        request = urllib.request.Request(
            self.webhook_url,
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json", "User-Agent": "crypto-trader/0.1"},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return 200 <= response.status < 300
        except urllib.error.URLError as exc:
            logger.error("Discord send failed: %s", exc)
            return False
