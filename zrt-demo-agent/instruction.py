from pathlib import Path

_INSTRUCTIONS_PATH = Path(__file__).with_name("instructions.md")
INSTRUCTIONS = _INSTRUCTIONS_PATH.read_text(encoding="utf-8") if _INSTRUCTIONS_PATH.exists() else ""
