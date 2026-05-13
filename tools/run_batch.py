"""Generate images from tools/assets-manifest.json with the OpenAI Images API.

The runner is resumable. It skips entries whose status is already generated or
postprocessed unless --retry-failed is supplied.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock


MANIFEST = Path("tools/assets-manifest.json")
MODEL_ENV = "OPENAI_IMAGE_MODEL"


def load_client():
    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("Missing dependency: python -m pip install openai") from exc
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set; generation was not started.")
    return OpenAI()


def response_bytes(resp) -> bytes:
    item = resp.data[0]
    b64 = getattr(item, "b64_json", None)
    if b64:
        return base64.b64decode(b64)
    url = getattr(item, "url", None)
    if url:
        with urllib.request.urlopen(url, timeout=120) as fh:
            return fh.read()
    raise RuntimeError("image response did not contain b64_json or url")


def save_candidates(resp, raw_path: Path) -> None:
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    for index, _ in enumerate(resp.data, start=1):
        data = response_bytes(type("Resp", (), {"data": [resp.data[index - 1]]})())
        if index == 1:
            raw_path.write_bytes(data)
        if len(resp.data) > 1:
            raw_path.with_name(f"{raw_path.stem}.{index}{raw_path.suffix}").write_bytes(data)


class RateLimiter:
    def __init__(self, rpm: int):
        self.interval = 60.0 / max(1, rpm)
        self.lock = Lock()
        self.next_at = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            if now < self.next_at:
                time.sleep(self.next_at - now)
            self.next_at = time.monotonic() + self.interval


def call_one(client, entry: dict, limiter: RateLimiter, model: str, max_attempts: int) -> tuple[str, str]:
    raw = Path(entry["raw_path"])
    raw.parent.mkdir(parents=True, exist_ok=True)
    refs = [Path(p) for p in entry.get("refs", [])]
    missing_refs = [str(p) for p in refs if not p.exists()]
    if missing_refs:
        return entry["id"], f"waiting refs: {', '.join(missing_refs[:3])}"

    api = entry["api"]
    for attempt in range(max_attempts):
        limiter.wait()
        handles = []
        try:
            handles = [p.open("rb") for p in refs]
            kwargs = {
                "model": model,
                "prompt": entry["prompt"],
                "size": api["size"],
                "background": api["background"],
                "quality": api["quality"],
                "n": int(api.get("n", 1)),
            }
            if handles:
                kwargs["image"] = handles if len(handles) > 1 else handles[0]
                resp = client.images.edit(**kwargs)
            else:
                resp = client.images.generate(**kwargs)
            save_candidates(resp, raw)
            entry["status"] = "generated"
            entry.pop("error", None)
            return entry["id"], "generated"
        except Exception as exc:  # pragma: no cover - network/API dependent
            wait = min(60, 2**attempt)
            entry["status"] = "failed"
            entry["error"] = str(exc)
            if attempt == max_attempts - 1:
                return entry["id"], f"failed: {exc}"
            time.sleep(wait)
        finally:
            for handle in handles:
                handle.close()
    return entry["id"], "failed"


def select_entries(manifest: list[dict], stage: str | None, limit: int | None, retry_failed: bool) -> list[dict]:
    allowed = {"pending"}
    if retry_failed:
        allowed.add("failed")
    rows = [
        entry
        for entry in manifest
        if (stage is None or entry.get("stage") == stage) and entry.get("status", "pending") in allowed
    ]
    return rows[:limit] if limit else rows


def run_postprocess(manifest_path: Path, stage: str) -> None:
    subprocess.run(
        ["python", "tools/postprocess.py", str(manifest_path), "--stage", stage],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=str(MANIFEST))
    parser.add_argument("--stage", choices=["0", "A", "B", "C", "D"])
    parser.add_argument("--limit", type=int)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--rpm", type=int, default=5)
    parser.add_argument("--attempts", type=int, default=4)
    parser.add_argument("--retry-failed", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-postprocess", action="store_true")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    stages = [args.stage] if args.stage else ["0", "A", "B", "C", "D"]

    if args.dry_run:
        for stage in stages:
            rows = select_entries(manifest, stage, args.limit, args.retry_failed)
            print(f"stage {stage}: {len(rows)} pending entries")
            for entry in rows[:10]:
                print(f"  {entry['id']} -> {entry['out_path']}")
        return

    client = load_client()
    model = os.environ.get(MODEL_ENV, "gpt-image-1")
    limiter = RateLimiter(args.rpm)

    for stage in stages:
        rows = select_entries(manifest, stage, args.limit, args.retry_failed)
        print(f"stage {stage}: generating {len(rows)} entries with {model}")
        if not rows:
            continue
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = [
                executor.submit(call_one, client, entry, limiter, model, args.attempts)
                for entry in rows
            ]
            for future in as_completed(futures):
                item_id, result = future.result()
                print(f"{item_id}: {result}")
                manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        if not args.no_postprocess:
            run_postprocess(manifest_path, stage)


if __name__ == "__main__":
    main()
