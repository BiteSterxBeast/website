"""
Updates videos.json for bitesterxbeast.com.

- Gets the newest uploads from all four channels with the YouTube Data API v3.
- Figures out which uploads are Shorts and which are long-form.
- Reads best-videos.txt and looks up each video's title.

Runs on GitHub Actions every 30 minutes (see .github/workflows/update-videos.yml).
Needs a repository secret named YOUTUBE_API_KEY. Uses only the Python standard library.
Uses about 300 of the API's 10,000 free daily quota units.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
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

PER_CHANNEL = 15
MAX_RECENT = 30
SHORT_MAX_SECONDS = 180  # fallback rule if the Shorts check can't tell

API = "https://www.googleapis.com/youtube/v3/"
API_KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


# ---------- YouTube Data API ----------

def api(endpoint, **params):
    params["key"] = API_KEY
    url = API + endpoint + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            msg = json.loads(body)["error"]["message"]
        except Exception:
            msg = body[:300]
        raise RuntimeError(f"YouTube API {e.code}: {msg}") from None


def channel_uploads_playlist(handle):
    data = api("channels", part="contentDetails", forHandle="@" + handle)
    items = data.get("items") or []
    if not items:
        raise RuntimeError(f"No channel found for @{handle}")
    return items[0]["contentDetails"]["relatedPlaylists"]["uploads"]


def latest_uploads(playlist_id, label):
    data = api("playlistItems", part="snippet,contentDetails",
               playlistId=playlist_id, maxResults=PER_CHANNEL)
    videos = []
    for item in data.get("items", []):
        vid = item["contentDetails"].get("videoId")
        published = (item["contentDetails"].get("videoPublishedAt")
                     or item["snippet"].get("publishedAt", ""))
        title = item["snippet"].get("title", "")
        if vid and title not in ("Private video", "Deleted video"):
            videos.append({"id": vid, "title": title, "channel": label,
                           "published": published})
    return videos


def video_details(ids):
    """Returns {id: {title, channel, seconds, live}} for up to any number of ids."""
    out = {}
    ids = list(ids)
    for i in range(0, len(ids), 50):
        data = api("videos", part="snippet,contentDetails",
                   id=",".join(ids[i:i + 50]), maxResults=50)
        for item in data.get("items", []):
            out[item["id"]] = {
                "title": item["snippet"].get("title", ""),
                "channel": item["snippet"].get("channelTitle", ""),
                "seconds": parse_duration(item["contentDetails"].get("duration", "")),
                "live": item["snippet"].get("liveBroadcastContent", "none"),
            }
    return out


def parse_duration(iso):
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


# ---------- Shorts check ----------

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


_no_redirect = urllib.request.build_opener(_NoRedirect)


def shorts_url_status(video_id):
    req = urllib.request.Request(f"https://www.youtube.com/shorts/{video_id}",
                                 headers=BROWSER_HEADERS)
    try:
        with _no_redirect.open(req, timeout=15) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None


def detect_type(video_id, seconds):
    """youtube.com/shorts/ID loads for a Short and redirects for a regular video.
    If YouTube won't answer, fall back to length (Shorts are 3 minutes or less)."""
    code = shorts_url_status(video_id)
    if code == 200:
        return "short"
    if code in (301, 302, 303, 307, 308):
        return "long"
    if seconds:
        return "short" if seconds <= SHORT_MAX_SECONDS else "long"
    return None


# ---------- best-videos.txt ----------

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
    playlists = dict(cache.get("playlists", {}))
    types = dict(cache.get("types", {}))
    old_recent = existing.get("recent", [])
    failures = 0

    # Recent uploads from every channel
    recent = []
    for label, handle in CHANNELS:
        try:
            if handle not in playlists:
                playlists[handle] = channel_uploads_playlist(handle)
                print(f"@{handle} -> uploads playlist {playlists[handle]}")
            vids = latest_uploads(playlists[handle], label)
            print(f"{label}: {len(vids)} uploads")
            recent.extend(vids)
        except Exception as e:
            failures += 1
            print(f"WARNING: {label} (@{handle}) failed: {e}", file=sys.stderr)
            recent.extend(v for v in old_recent if v.get("channel") == label)

    seen = {}
    for v in recent:
        seen[v["id"]] = v
    recent = sorted(seen.values(), key=lambda v: v["published"], reverse=True)

    best_ids = read_best_ids()

    # One batched lookup for durations, live status and best-video titles
    details = {}
    try:
        details = video_details({v["id"] for v in recent} | set(best_ids))
    except Exception as e:
        print(f"WARNING: video details failed: {e}", file=sys.stderr)

    # drop upcoming premieres / live streams that haven't happened yet
    recent = [v for v in recent if details.get(v["id"], {}).get("live") != "upcoming"]
    recent = recent[:MAX_RECENT]

    for v in recent:
        if v["id"] not in types:
            t = detect_type(v["id"], details.get(v["id"], {}).get("seconds", 0))
            if t:
                types[v["id"]] = t
        v["type"] = types.get(v["id"], "unknown")

    best = []
    for vid in best_ids:
        d = details.get(vid, {})
        best.append({"id": vid, "title": d.get("title", ""), "channel": d.get("channel", "")})

    keep = {v["id"] for v in recent}
    data = {
        "best": best,
        "recent": recent,
        "_cache": {
            "playlists": playlists,
            "types": {k: t for k, t in types.items() if k in keep},
        },
    }
    return data, failures


def main():
    if not API_KEY:
        sys.exit("ERROR: the YOUTUBE_API_KEY secret is missing. "
                 "Add it under Settings > Secrets and variables > Actions.")

    existing = load_existing()
    data, failures = build(existing)

    def comparable(d):
        return {k: d.get(k) for k in ("best", "recent", "_cache")}

    if comparable(data) != comparable(existing):
        data["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        ordered = {"updated": data["updated"], "best": data["best"],
                   "recent": data["recent"], "_cache": data["_cache"]}
        OUT_FILE.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
        print(f"Wrote {len(data['recent'])} recent and {len(data['best'])} best videos.")
    else:
        print("No changes.")

    if failures == len(CHANNELS):
        sys.exit("ERROR: every channel failed. See the warnings above.")


if __name__ == "__main__":
    main()
