from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

import pandas as pd


class SignalAction(str, Enum):
    HOLD = "hold"
    BUY = "buy"
    SELL = "sell"


@dataclass
class Signal:
    action: SignalAction
    strength: float = 1.0
    reason: str = ""


class Strategy(ABC):
    name: str = "base"

    def __init__(self, params: dict | None = None) -> None:
        self.params = params or {}

    @abstractmethod
    def generate_signal(self, candles: pd.DataFrame) -> Signal:
        raise NotImplementedError

    def warmup_bars(self) -> int:
        return 50
