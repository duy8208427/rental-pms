"""Save latest CDP Page.captureScreenshot JSON to a PNG frame."""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

from PIL import Image

LOG_DIR = Path(r"C:\Users\kimli\.cursor\browser-logs")
FRAMES = Path(r"D:\New folder\Quản lý VP, KS, Xưởng\demo\frames")


def latest_capture() -> Path:
    files = sorted(LOG_DIR.glob("cdp-response-Page.captureScreenshot-*.json"))
    if not files:
        raise SystemExit("No CDP screenshot responses found")
    return files[-1]


def extract_b64(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    b64 = data.get("data")
    if not b64 and isinstance(data.get("result"), dict):
        b64 = data["result"].get("data")
    if not b64:
        raise SystemExit(f"No data in {path.name}: keys={list(data.keys())}")
    return b64


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: save_cdp_frame.py NN.png")
    name = sys.argv[1]
    FRAMES.mkdir(parents=True, exist_ok=True)
    src = latest_capture()
    out = FRAMES / name
    out.write_bytes(base64.b64decode(extract_b64(src)))
    im = Image.open(out)
    print(f"{name} size={im.size[0]}x{im.size[1]} bytes={out.stat().st_size} from={src.name}")


if __name__ == "__main__":
    main()
