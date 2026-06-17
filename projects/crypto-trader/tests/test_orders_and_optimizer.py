from __future__ import annotations

from src.backtest.optimizer import expand_param_grid, run_grid_search
from src.config import AppConfig, RiskConfig, TradingConfig
from src.exchange.mock_client import MockExchangeClient
from src.trading.order_executor import (
    OrderExecutor,
    build_oco_bracket,
    compute_limit_price,
    paper_limit_would_fill,
)


def test_compute_limit_price_buy_below_market() -> None:
    price = compute_limit_price("buy", 100.0, -0.01)
    assert price == 99.0


def test_compute_limit_price_sell_above_market() -> None:
    price = compute_limit_price("sell", 100.0, 0.01)
    assert price == 101.0


def test_paper_limit_fill_rules() -> None:
    assert paper_limit_would_fill("buy", 100.0, 99.0) is True
    assert paper_limit_would_fill("buy", 100.0, 101.0) is False
    assert paper_limit_would_fill("sell", 100.0, 101.0) is True
    assert paper_limit_would_fill("sell", 100.0, 99.0) is False


def test_build_oco_bracket() -> None:
    bracket = build_oco_bracket(100.0, RiskConfig(stop_loss_pct=0.03, take_profit_pct=0.06))
    assert bracket.stop_price == 97.0
    assert bracket.take_profit_price == 106.0


def test_order_executor_market_buy_paper() -> None:
    from src.config import AppConfig

    config = AppConfig(trading=TradingConfig(order_type="market"))
    executor = OrderExecutor(config, MockExchangeClient(), live=False)
    fill = executor.buy("BTC/USDT", 0.01, 50000.0)
    assert fill is not None
    assert fill.order_type == "market"


def test_order_executor_limit_buy_skips_when_not_fillable() -> None:
    from src.config import AppConfig

    config = AppConfig(
        trading=TradingConfig(
            order_type="limit",
            limit_buy_offset_pct=-0.01,
        )
    )
    executor = OrderExecutor(config, MockExchangeClient(), live=False)
    fill = executor.buy("BTC/USDT", 0.01, 100.0)
    assert fill is None


def test_order_executor_oco_on_live_mock() -> None:
    from src.config import AppConfig

    config = AppConfig(trading=TradingConfig(oco_enabled=True))
    executor = OrderExecutor(config, MockExchangeClient(), live=True)
    bracket = executor.place_oco_exit("BTC/USDT", 0.01, 100.0)
    assert bracket is not None
    assert bracket.order_list_id == "mock-oco-1"


def test_expand_param_grid() -> None:
    grid = expand_param_grid({"fast_period": [5, 10], "slow_period": [20, 30]})
    assert len(grid) == 4
    assert {"fast_period": 5, "slow_period": 20} in grid


def test_run_grid_search_offline() -> None:
    config = AppConfig()
    config.strategy.name = "sma_crossover"
    config.strategy.params = {"fast_period": 10, "slow_period": 30}
    results = run_grid_search(
        config,
        MockExchangeClient(bars=500),
        {"fast_period": [5, 10], "slow_period": [20, 30]},
    )
    assert len(results) == 4
    assert "total_return_pct" in results.columns
