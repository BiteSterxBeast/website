"""
Updates videos.json for bitesterxbeast.com.

- Reads the newest uploads from all four channels (public YouTube feeds, no API key).
- Figures out which uploads are Shorts and which are long-form.
- Reads best-videos.txt and looks up each video's title.

Runs on GitHub Actions every 30 minutes (see .github/workflows/update-videos.yml).
Uses only the Python standard library.
"""

import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "videos.json"
BEST_FILE = ROOT / "best-videos.txt"

# (label shown on the site, YouTube handle without the @)
CHANNELS = [
    ("Main", "BiteSterxBeast"),
    ("Experiments", "BiteSterxBeastExperiments"),
    ("Extras", "BiteSterxBeastExtras"),
    ("Minecraft", "BitePlaysMC"),
]

MAX_RECENT = 30

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Cookie": "CONSENT=YES+1; SOCS=CAI",
}

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}


# ---------- network helpers ----------

def get(url, timeout=20):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


_no_redirect_opener = urllib.request.build_opener(_NoRedirect)


def status_without_redirect(url, timeout=20):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with _no_redirect_opener.open(req, timeout=timeout) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


# ---------- YouTube lookups ----------

CHANNEL_ID_PATTERNS = [
    r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[\w-]{22})"',
    r'"externalId":"(UC[\w-]{22})"',
    r'<meta itemprop="identifier" content="(UC[\w-]{22})"',
    r'"browseId":"(UC[\w-]{22})"',
]


def resolve_channel_id(handle):
    html = get(f"https://www.youtube.com/@{handle}")
    for pattern in CHANNEL_ID_PATTERNS:
        m = re.search(pattern, html)
        if m:
            return m.group(1)
    raise RuntimeError(f"Could not find channel ID for @{handle}")


def parse_feed(xml_text, label):
    root = ET.fromstring(xml_text)
    videos = []
    for entry in root.findall("atom:entry", NS):
        vid = entry.findtext("yt:videoId", default="", namespaces=NS)
        title = entry.findtext("atom:title", default="", namespaces=NS)
        published = entry.findtext("atom:published", default="", namespaces=NS)
        if vid:
            videos.append({
                "id": vid,
                "title": title.strip(),
                "channel": label,
                "published": published,
            })
    return videos


def fetch_feed(channel_id, label):
    xml_text = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
    return parse_feed(xml_text, label)


def detect_type(video_id):
    """youtube.com/shorts/ID loads for a Short and redirects for a regular video."""
    code = status_without_redirect(f"https://www.youtube.com/shorts/{video_id}")
    if code == 200:
        return "short"
    if code in (301, 302, 303, 307, 308):
        return "long"
    return None  # unsure, try again next run


def oembed(video_id):
    url = ("https://www.youtube.com/oembed?format=json&url="
           f"https://www.youtube.com/watch?v={video_id}")
    data = json.loads(get(url))
    return data.get("title", ""), data.get("author_name", "")


VIDEO_ID_PATTERNS = [
    r"[?&]v=([\w-]{11})",
    r"youtu\.be/([\w-]{11})",
    r"/shorts/([\w-]{11})",
    r"/embed/([\w-]{11})",
    r"^([\w-]{11})$",
]


def extract_video_id(text):
    text = text.strip()
    for pattern in VIDEO_ID_PATTERNS:
        m = re.search(pattern, text)
        if m:
            return m.group(1)
    return None


def read_best_ids():
    if not BEST_FILE.exists():
        return []
    ids = []
    for line in BEST_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        vid = extract_video_id(line)
        if vid:
            ids.append(vid)
    return ids


# ---------- main ----------

def load_existing():
    if OUT_FILE.exists():
        try:
            return json.loads(OUT_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {}


def build(existing):
    cache = existing.get("_cache", {})
    channel_ids = dict(cache.get("channels", {}))
    types = dict(cache.get("types", {}))
    titles = dict(cache.get("titles", {}))
    old_recent = {v["id"]: v for v in existing.get("recent", [])}

    # Recent uploads from every channel
    recent = []
    for label, handle in CHANNELS:
        try:
            if handle not in channel_ids:
                channel_ids[handle] = resolve_channel_id(handle)
                print(f"@{handle} -> {channel_ids[handle]}")
            recent.extend(fetch_feed(channel_ids[handle], label))
        except Exception as e:
            print(f"WARNING: {label} (@{handle}) failed: {e}", file=sys.stderr)
            # keep what we had for this channel so it doesn't vanish
            recent.extend(v for v in old_recent.values() if v["channel"] == label)

    # de-duplicate, newest first
    seen = {}
    for v in recent:
        seen[v["id"]] = v
    recent = sorted(seen.values(), key=lambda v: v["published"], reverse=True)[:MAX_RECENT]

    for v in recent:
        if v["id"] not in types:
            try:
                t = detect_type(v["id"])
                if t:
                    types[v["id"]] = t
            except Exception as e:
                print(f"WARNING: type check failed for {v['id']}: {e}", file=sys.stderr)
        v["type"] = types.get(v["id"], "unknown")

    # Best videos
    best = []
    for vid in read_best_ids():
        if vid not in titles:
            try:
                titles[vid] = list(oembed(vid))
            except Exception as e:
                print(f"WARNING: title lookup failed for {vid}: {e}", file=sys.stderr)
        title, author = titles.get(vid, ["", ""])
        best.append({"id": vid, "title": title, "channel": author})

    keep_ids = {v["id"] for v in recent}
    best_ids = {b["id"] for b in best}
    return {
        "best": best,
        "recent": recent,
        "_cache": {
            "channels": channel_ids,
            "types": {k: v for k, v in types.items() if k in keep_ids},
            "titles": {k: v for k, v in titles.items() if k in best_ids},
        },
    }


def main():
    existing = load_existing()
    data = build(existing)

    # only touch the file when something actually changed
    def comparable(d):
        return {k: d.get(k) for k in ("best", "recent", "_cache")}

    if comparable(data) == comparable(existing):
        print("No changes.")
        return

    data["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    ordered = {"updated": data["updated"], "best": data["best"],
               "recent": data["recent"], "_cache": data["_cache"]}
    OUT_FILE.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    print(f"Wrote {len(data['recent'])} recent and {len(data['best'])} best videos.")


if __name__ == "__main__":
    main()
