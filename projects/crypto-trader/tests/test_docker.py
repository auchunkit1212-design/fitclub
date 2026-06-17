from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_docker_files_exist() -> None:
    assert (ROOT / "Dockerfile").exists()
    assert (ROOT / "docker-compose.yml").exists()
    assert (ROOT / "docker" / "entrypoint.sh").exists()


def test_entrypoint_supports_modes() -> None:
    script = (ROOT / "docker" / "entrypoint.sh").read_text(encoding="utf-8")
    for mode in ("paper", "live", "backtest", "dashboard", "cache"):
        assert mode in script
