#!/usr/bin/env python3
"""Extract project archives, including .rar when a local backend is available."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


RAR_BACKENDS = (
    ("bsdtar", lambda archive, dest: ["bsdtar", "-xf", str(archive), "-C", str(dest)]),
    ("unar", lambda archive, dest: ["unar", "-force-overwrite", "-o", str(dest), str(archive)]),
    ("unrar", lambda archive, dest: ["unrar", "x", "-o+", str(archive), str(dest)]),
    ("7zz", lambda archive, dest: ["7zz", "x", f"-o{dest}", "-y", str(archive)]),
    ("7z", lambda archive, dest: ["7z", "x", f"-o{dest}", "-y", str(archive)]),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract a .rar or .zip archive into a target directory."
    )
    parser.add_argument("archive", help="Path to the archive file")
    parser.add_argument(
        "-o",
        "--output",
        help="Output directory. Defaults to a folder next to the archive.",
    )
    return parser.parse_args()


def default_output_dir(archive: Path) -> Path:
    suffixes = "".join(archive.suffixes)

    if suffixes:
        name = archive.name[: -len(suffixes)]
    else:
        name = archive.stem

    return archive.with_name(name or "extracted")


def ensure_safe_zip_member(destination: Path, member_name: str) -> None:
    target = (destination / member_name).resolve()
    destination_resolved = destination.resolve()

    if target != destination_resolved and destination_resolved not in target.parents:
        raise RuntimeError(f"Archive entry escapes output directory: {member_name}")


def extract_zip(archive: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive) as zipped:
        for member in zipped.infolist():
            ensure_safe_zip_member(destination, member.filename)

        zipped.extractall(destination)


def extract_rar(archive: Path, destination: Path) -> str:
    for name, build_command in RAR_BACKENDS:
        if not shutil.which(name):
            continue

        command = build_command(archive, destination)
        completed = subprocess.run(
            command,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )

        if completed.returncode == 0:
            return name

        raise RuntimeError(
            f"{name} was found but failed to extract {archive}:\n{completed.stdout}"
        )

    raise RuntimeError(
        "No RAR extractor was found. Install one of: bsdtar, unar, unrar, 7zz, or 7z."
    )


def main() -> int:
    args = parse_args()
    archive = Path(args.archive).expanduser().resolve()

    if not archive.is_file():
        print(f"Archive not found: {archive}", file=sys.stderr)
        return 1

    destination = (
        Path(args.output).expanduser().resolve()
        if args.output
        else default_output_dir(archive).resolve()
    )
    destination.mkdir(parents=True, exist_ok=True)

    suffix = archive.suffix.lower()

    try:
        if suffix == ".zip":
            extract_zip(archive, destination)
            backend = "python-zipfile"
        elif suffix == ".rar":
            backend = extract_rar(archive, destination)
        else:
            print(f"Unsupported archive type: {archive.suffix}", file=sys.stderr)
            return 1
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    print(f"Extracted {archive} to {destination} using {backend}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
