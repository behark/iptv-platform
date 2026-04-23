#!/usr/bin/env python3
"""
M3U Playlist Cleaner
====================
Parses an M3U playlist and removes duplicates, Chinese channels, Indian channels,
adult/suspicious channels, and likely dead/placeholder URLs. Optionally tests a
random sample of stream URLs.

Usage:
    python clean-playlist.py
    python clean-playlist.py --test
    python clean-playlist.py --dry-run
    python clean-playlist.py --input custom.m3u --output cleaned.m3u
"""

from __future__ import annotations

import argparse
import random
import re
import sys
import time
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_INPUT = "/home/behar/iptv-platform/iptv_full_playlist.m3u"
DEFAULT_OUTPUT = "/home/behar/iptv-platform/iptv_cleaned_playlist.m3u"
REPORT_PATH = "/home/behar/iptv-platform/cleanup_report.txt"

# Regex to parse the #EXTINF line attributes
EXTINF_ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')

# Chinese character Unicode range
CHINESE_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")

# Hindi / Devanagari script Unicode range
DEVANAGARI_RE = re.compile(r"[\u0900-\u097f]")

# Adult / suspicious keywords (case-insensitive)
ADULT_KEYWORDS = [
    "xxx", "adult", "18+", "porn", "sex", "erotic",
    "playboy", "hustler", "brazzers", "xnxx", "xvideos",
    "redtube", "pornhub", "naked", "nude channel",
]

# Indian language codes (lowercase) -- used to match tvg-language
INDIAN_LANGUAGE_CODES = {
    "hin", "hindi",
    "tam", "tamil",
    "tel", "telugu",
    "kan", "kannada",
    "mal", "malayalam",
    "ben", "bengali",
    "mar", "marathi",
    "guj", "gujarati",
    "pan", "punjabi",
    "ori", "oriya", "odia",
    "urd", "urdu",
}

# Placeholder / dead URL patterns
DEAD_URL_PATTERNS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "example.com",
    "example.org",
    "test.com",
]

# CCTV / CGTN international English versions we want to KEEP
CCTV_ENGLISH_KEEP = re.compile(
    r"(CGTN|CCTV).*(english|en\b|int|international|america|europe|africa|french|spanish|russian|arabic|documentary)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Channel:
    """Represents a single channel entry in an M3U playlist."""

    extinf_line: str
    url: str
    name: str = ""
    tvg_country: str = ""
    tvg_language: str = ""
    group_title: str = ""
    raw_attrs: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_extinf(cls, extinf_line: str, url: str) -> Channel:
        """Parse an #EXTINF line and its URL into a Channel object."""
        attrs: dict[str, str] = {}
        for match in EXTINF_ATTR_RE.finditer(extinf_line):
            attrs[match.group(1).lower()] = match.group(2)

        # Channel display name comes after the last comma in the EXTINF line
        name = ""
        comma_idx = extinf_line.rfind(",")
        if comma_idx != -1:
            name = extinf_line[comma_idx + 1:].strip()

        return cls(
            extinf_line=extinf_line,
            url=url.strip(),
            name=name,
            tvg_country=attrs.get("tvg-country", ""),
            tvg_language=attrs.get("tvg-language", ""),
            group_title=attrs.get("group-title", ""),
            raw_attrs=attrs,
        )


@dataclass
class RemovalStats:
    """Tracks how many channels were removed in each category."""

    duplicates: int = 0
    chinese: int = 0
    indian: int = 0
    adult: int = 0
    dead_placeholder: int = 0
    malformed: int = 0

    @property
    def total_removed(self) -> int:
        return (
            self.duplicates
            + self.chinese
            + self.indian
            + self.adult
            + self.dead_placeholder
            + self.malformed
        )


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_m3u(filepath: str) -> tuple[list[Channel], int]:
    """
    Parse an M3U file into a list of Channel objects.

    Returns:
        A tuple of (channels, malformed_count).
    """
    channels: list[Channel] = []
    malformed = 0
    path = Path(filepath)

    if not path.exists():
        print(f"ERROR: Input file not found: {filepath}")
        sys.exit(1)

    content = path.read_text(encoding="utf-8", errors="replace")
    lines = content.splitlines()

    # Skip the #EXTM3U header if present
    start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.upper().startswith("#EXTM3U"):
            start = i + 1
            break
        if stripped and not stripped.startswith("#"):
            # No header found, start from beginning
            break

    i = start
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines and comments that are not #EXTINF
        if not line or (line.startswith("#") and not line.upper().startswith("#EXTINF")):
            i += 1
            continue

        if line.upper().startswith("#EXTINF"):
            # Look for the URL on the next non-empty, non-comment line
            url = ""
            j = i + 1
            while j < len(lines):
                next_line = lines[j].strip()
                if next_line and not next_line.startswith("#"):
                    url = next_line
                    break
                if next_line.upper().startswith("#EXTINF"):
                    # Another EXTINF without a URL -- malformed
                    break
                j += 1

            if url:
                try:
                    channels.append(Channel.from_extinf(line, url))
                except Exception:
                    malformed += 1
                i = j + 1
            else:
                malformed += 1
                i += 1
        else:
            # Bare URL without EXTINF -- skip as malformed
            malformed += 1
            i += 1

    return channels, malformed


# ---------------------------------------------------------------------------
# Filtering logic
# ---------------------------------------------------------------------------

def is_chinese_channel(ch: Channel) -> bool:
    """Detect Chinese channels while keeping international English versions."""
    name_lower = ch.name.lower()

    # Check for CCTV/CGTN but keep international/English versions
    if re.search(r"\bcctv|cgtn", name_lower):
        if CCTV_ENGLISH_KEEP.search(ch.name):
            return False
        # If it has a number suffix like "CCTV-4" or bare "CCTV1" and no English marker, remove
        return True

    # Country code check
    country = ch.tvg_country.upper()
    if country in ("CN", "CHINA"):
        return True

    # Group title check
    group = ch.group_title.lower()
    if any(kw in group for kw in ("china", "chinese")):
        return True

    # Chinese characters in the channel name
    if CHINESE_CHAR_RE.search(ch.name):
        return True

    return False


def is_indian_channel(ch: Channel) -> bool:
    """Detect Indian channels, keeping English-language channels from India."""
    # Devanagari script in channel name -- always remove
    if DEVANAGARI_RE.search(ch.name):
        return True

    country = ch.tvg_country.upper()
    group = ch.group_title.lower()
    lang = ch.tvg_language.lower()

    # Check for Indian language codes
    lang_tokens = {tok.strip() for tok in re.split(r"[;,/|]", lang) if tok.strip()}
    if lang_tokens & INDIAN_LANGUAGE_CODES:
        return True

    # Country-based check -- but skip if the language is English
    is_english = "en" in lang_tokens or "eng" in lang_tokens or "english" in lang_tokens
    if country in ("IN", "INDIA") and not is_english:
        return True

    # Group title check -- but skip if language is English
    if any(kw in group for kw in ("india", "indian")) and not is_english:
        return True

    return False


def is_adult_channel(ch: Channel) -> bool:
    """Detect adult/suspicious channels by keyword matching."""
    name_lower = ch.name.lower()
    group_lower = ch.group_title.lower()
    combined = f"{name_lower} {group_lower}"
    return any(kw in combined for kw in ADULT_KEYWORDS)


def is_dead_placeholder(ch: Channel) -> bool:
    """Detect URLs that are clearly placeholder or invalid."""
    url = ch.url.strip()

    # Empty URL
    if not url:
        return True

    # Check for placeholder/localhost patterns
    url_lower = url.lower()
    for pattern in DEAD_URL_PATTERNS:
        if pattern in url_lower:
            return True

    # Very short or clearly invalid URLs
    if len(url) < 10:
        return True

    # Check if the URL has no valid scheme
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https", "rtmp", "rtsp", "mms", "mmsh", "udp", "rtp"):
        return True

    return False


def clean_playlist(
    channels: list[Channel],
    malformed_count: int,
) -> tuple[list[Channel], RemovalStats]:
    """
    Apply all cleaning filters to the channel list.

    Returns:
        A tuple of (cleaned_channels, stats).
    """
    stats = RemovalStats(malformed=malformed_count)
    seen_urls: set[str] = set()
    cleaned: list[Channel] = []

    for ch in channels:
        # --- Duplicate check (by URL, keep first occurrence) ---
        url_normalized = ch.url.strip().lower()
        if url_normalized in seen_urls:
            stats.duplicates += 1
            continue
        seen_urls.add(url_normalized)

        # --- Dead / placeholder URL ---
        if is_dead_placeholder(ch):
            stats.dead_placeholder += 1
            continue

        # --- Adult / suspicious ---
        if is_adult_channel(ch):
            stats.adult += 1
            continue

        # --- Chinese channels ---
        if is_chinese_channel(ch):
            stats.chinese += 1
            continue

        # --- Indian channels ---
        if is_indian_channel(ch):
            stats.indian += 1
            continue

        cleaned.append(ch)

    return cleaned, stats


# ---------------------------------------------------------------------------
# URL testing (optional)
# ---------------------------------------------------------------------------

def test_stream_urls(channels: list[Channel], sample_size: int = 50, timeout: int = 5) -> dict:
    """
    Test a random sample of stream URLs to estimate dead channel percentage.

    Uses urllib to avoid external dependencies.
    """
    import urllib.request
    import urllib.error

    sample = random.sample(channels, min(sample_size, len(channels)))
    results = {"tested": len(sample), "alive": 0, "dead": 0, "errors": []}

    print(f"\nTesting {len(sample)} random stream URLs (timeout={timeout}s)...")
    for i, ch in enumerate(sample, 1):
        status = "DEAD"
        try:
            req = urllib.request.Request(ch.url, method="HEAD")
            req.add_header("User-Agent", "Mozilla/5.0 (IPTV Checker)")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status < 400:
                    status = "ALIVE"
                    results["alive"] += 1
                else:
                    results["dead"] += 1
                    results["errors"].append((ch.name, ch.url, f"HTTP {resp.status}"))
        except Exception as exc:
            # Try GET if HEAD fails (some servers don't support HEAD)
            try:
                req = urllib.request.Request(ch.url, method="GET")
                req.add_header("User-Agent", "Mozilla/5.0 (IPTV Checker)")
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    if resp.status < 400:
                        status = "ALIVE"
                        results["alive"] += 1
                    else:
                        results["dead"] += 1
                        results["errors"].append((ch.name, ch.url, f"HTTP {resp.status}"))
            except Exception as exc2:
                results["dead"] += 1
                results["errors"].append((ch.name, ch.url, str(exc2)[:80]))

        progress = f"[{i}/{len(sample)}]"
        print(f"  {progress} {status:5s} | {ch.name[:50]}")

    return results


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_m3u(channels: list[Channel], filepath: str) -> None:
    """Write the cleaned channel list to an M3U file."""
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        for ch in channels:
            f.write(f"{ch.extinf_line}\n")
            f.write(f"{ch.url}\n")

    print(f"\nCleaned playlist saved to: {filepath}")


def write_report(
    stats: RemovalStats,
    original_count: int,
    final_count: int,
    filepath: str,
    test_results: Optional[dict] = None,
) -> None:
    """Write a detailed cleanup report to a text file."""
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "=" * 60,
        "IPTV Playlist Cleanup Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 60,
        "",
        "SUMMARY",
        "-" * 40,
        f"  Original channels:       {original_count:>6}",
        f"  Final channels:          {final_count:>6}",
        f"  Total removed:           {stats.total_removed:>6}",
        "",
        "REMOVAL BREAKDOWN",
        "-" * 40,
        f"  Duplicates:              {stats.duplicates:>6}",
        f"  Chinese channels:        {stats.chinese:>6}",
        f"  Indian channels:         {stats.indian:>6}",
        f"  Adult/suspicious:        {stats.adult:>6}",
        f"  Dead/placeholder URLs:   {stats.dead_placeholder:>6}",
        f"  Malformed entries:       {stats.malformed:>6}",
        "",
    ]

    if test_results:
        pct_alive = (
            (test_results["alive"] / test_results["tested"] * 100)
            if test_results["tested"] > 0
            else 0
        )
        pct_dead = 100 - pct_alive
        lines.extend([
            "URL HEALTH CHECK (sample)",
            "-" * 40,
            f"  Tested:                  {test_results['tested']:>6}",
            f"  Alive:                   {test_results['alive']:>6} ({pct_alive:.1f}%)",
            f"  Dead/Unreachable:        {test_results['dead']:>6} ({pct_dead:.1f}%)",
            f"  Estimated dead in full:  ~{int(final_count * pct_dead / 100):>5}",
            "",
        ])
        if test_results["errors"]:
            lines.append("  Failed URLs (sample):")
            for name, url, err in test_results["errors"][:20]:
                lines.append(f"    - {name[:40]:40s} | {err}")
            lines.append("")

    lines.extend([
        "=" * 60,
        "End of report",
    ])

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Report saved to: {filepath}")


def print_stats(stats: RemovalStats, original: int, final: int) -> None:
    """Print statistics to stdout."""
    print("\n" + "=" * 50)
    print("  IPTV Playlist Cleanup Statistics")
    print("=" * 50)
    print(f"  Original channels:       {original:>6}")
    print(f"  Duplicates removed:      {stats.duplicates:>6}")
    print(f"  Chinese removed:         {stats.chinese:>6}")
    print(f"  Indian removed:          {stats.indian:>6}")
    print(f"  Adult/suspicious:        {stats.adult:>6}")
    print(f"  Dead/placeholder URLs:   {stats.dead_placeholder:>6}")
    print(f"  Malformed entries:       {stats.malformed:>6}")
    print(f"  ---")
    print(f"  Total removed:           {stats.total_removed:>6}")
    print(f"  Final channels:          {final:>6}")
    print("=" * 50)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clean an M3U playlist by removing duplicates, unwanted channels, and dead URLs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python clean-playlist.py                    # Clean with defaults\n"
            "  python clean-playlist.py --test             # Clean + test 50 random URLs\n"
            "  python clean-playlist.py --dry-run          # Preview stats without writing\n"
            "  python clean-playlist.py --input my.m3u     # Use custom input file\n"
        ),
    )
    parser.add_argument(
        "--input", "-i",
        default=DEFAULT_INPUT,
        help=f"Path to the input M3U file (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--output", "-o",
        default=DEFAULT_OUTPUT,
        help=f"Path for the cleaned M3U output (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--test", "-t",
        action="store_true",
        help="Test a random sample of 50 stream URLs for availability",
    )
    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="Show statistics without writing the output file",
    )

    args = parser.parse_args()

    # --- Parse ---
    print(f"Parsing: {args.input}")
    start_time = time.time()
    channels, malformed_count = parse_m3u(args.input)
    original_count = len(channels) + malformed_count
    parse_time = time.time() - start_time
    print(f"  Parsed {len(channels)} channels in {parse_time:.2f}s ({malformed_count} malformed entries skipped)")

    # --- Clean ---
    print("Cleaning...")
    cleaned, stats = clean_playlist(channels, malformed_count)
    final_count = len(cleaned)

    # --- Stats ---
    print_stats(stats, original_count, final_count)

    # --- Optional URL testing ---
    test_results = None
    if args.test:
        test_results = test_stream_urls(cleaned)
        if test_results["tested"] > 0:
            pct = test_results["alive"] / test_results["tested"] * 100
            print(f"\n  Stream health: {pct:.1f}% alive ({test_results['alive']}/{test_results['tested']})")

    # --- Write output ---
    if not args.dry_run:
        write_m3u(cleaned, args.output)
        write_report(stats, original_count, final_count, REPORT_PATH, test_results)
    else:
        print("\n  [DRY RUN] No files written.")


if __name__ == "__main__":
    main()
