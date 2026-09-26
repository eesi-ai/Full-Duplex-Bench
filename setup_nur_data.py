#!/usr/bin/env python3
"""Download, verify, and extract the released FDB v1/v1.5 and v3 audio."""

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "NUR_DATA_MANIFEST.json").read_text())


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def unpack(path: Path, destination: Path) -> None:
    with ZipFile(path) as archive:
        for name in archive.namelist():
            member = Path(name)
            if name.startswith("__MACOSX/"):
                continue
            if member.is_absolute() or ".." in member.parts:
                raise ValueError(f"Unsafe zip member in {path.name}: {name}")
            archive.extract(name, destination)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    v1_root = ROOT / "v1_v1.5/dataset/Full-Duplex-Bench-Data"
    v3_zip = ROOT / "v3/fdb_v3_data_released.zip"
    if not args.verify_only:
        if any(not (ROOT / relative).exists() for relative in MANIFEST["archives"] if relative.startswith("v1_v1.5/")):
            subprocess.run(["gdown", "--folder", MANIFEST["source_urls"]["v1_v1_5"], "-O", str(v1_root.parent)], check=True)
        if not v3_zip.exists():
            # The folder release may already contain this same archive.
            bundled = v1_root / "v3.0/fdb_v3_data_released.zip"
            if bundled.exists():
                shutil.copy2(bundled, v3_zip)
            else:
                subprocess.run(["gdown", MANIFEST["source_urls"]["v3"], "-O", str(v3_zip)], check=True)

    for relative, expected in MANIFEST["archives"].items():
        path = ROOT / relative
        if not path.exists() or path.stat().st_size != expected["bytes"] or digest(path) != expected["sha256"]:
            raise ValueError(f"Missing or changed release archive: {relative}")
        if not args.verify_only:
            unpack(path, ROOT / "v3" if path == v3_zip else path.parent)
        print(f"Verified {relative}")

    roots = {
        "v1.0": v1_root / "v1.0",
        "v1.5": v1_root / "v1.5",
        "v3": ROOT / "v3/fdb_v3_data_released",
    }
    for version, folder in roots.items():
        count = len(list(folder.glob("*/*/input.wav"))) if version != "v3" else len(list(folder.glob("*/input.wav")))
        expected = MANIFEST["sample_counts"][version]
        if count != expected:
            raise ValueError(f"{version}: found {count} input WAVs, expected {expected}")
        print(f"{version}: {count} input WAVs")


if __name__ == "__main__":
    main()
