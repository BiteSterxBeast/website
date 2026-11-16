"""
Updates videos.json for bitesterxbeast.com.

- Keeps EVERY upload from every channel in videos.json.
  * Full sync (first run, then once a day): pages through each channel's whole upload
    list. This also drops videos you deleted or made private and picks up title changes.
  * Quick sync (every other run): only grabs each channel's newest 50 uploads and adds
    them to what's already saved.
- Figures out which uploads are Shorts and which are long-form.
- Saves each video's view count (newest videos every run, all videos on the daily full sync).
- Grabs each channel's profile picture.
- Reads best-videos.txt and looks up each video's title.

Runs on GitHub Actions every 30 minutes (see .github/workflows/update-videos.yml).
Needs a repository secret named YOUTUBE_API_KEY. Uses only the Python standard library.
Quota (10,000 free units a day): a quick sync costs about 12 units (~580 a day);
a full sync costs about 1 unit per 25 videos (roughly 40-60 units for ~1,000 videos).
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
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
    ("JoshSham", "JoshSham"),
]

PER_PAGE = 50          # most videos one API call returns
FULL_SYNC_HOURS = 24   # how often to re-read every channel's whole upload list
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


def _upload_items(item, label):
    vid = item["contentDetails"].get("videoId")
    published = (item["contentDetails"].get("videoPublishedAt")
                 or item["snippet"].get("publishedAt", ""))
    title = item["snippet"].get("title", "")
    if vid and title not in ("Private video", "Deleted video"):
        return {"id": vid, "title": title, "channel": label, "published": published}
    return None


def channel_uploads(playlist_id, label, everything):
    """Newest 50 uploads, or every upload when everything=True (1 quota unit per 50)."""
    videos, token = [], None
    while True:
        params = dict(part="snippet,contentDetails", playlistId=playlist_id, maxResults=PER_PAGE)
        if token:
            params["pageToken"] = token
        data = api("playlistItems", **params)
        for item in data.get("items", []):
            v = _upload_items(item, label)
            if v:
                videos.append(v)
        token = data.get("nextPageToken")
        if not everything or not token:
            return videos


def channel_avatars(playlists):
    """{handle: profile picture URL} for every channel, in one call (1 quota unit).
    A channel's uploads playlist is its channel ID with UC swapped for UU."""
    ids = {"UC" + pl[2:]: handle for handle, pl in playlists.items() if pl.startswith("UU")}
    if not ids:
        return {}
    data = api("channels", part="snippet", id=",".join(ids), maxResults=50)
    out = {}
    for item in data.get("items", []):
        thumbs = item["snippet"].get("thumbnails", {})
        best = thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}
        if item["id"] in ids and best.get("url"):
            out[ids[item["id"]]] = best["url"]
    return out


def video_details(ids):
    """Returns {id: {title, channel, seconds, live}} for up to any number of ids."""
    out = {}
    ids = list(ids)
    for i in range(0, len(ids), 50):
        data = api("videos", part="snippet,contentDetails,statistics",
                   id=",".join(ids[i:i + 50]), maxResults=50)
        for item in data.get("items", []):
            out[item["id"]] = {
                "title": item["snippet"].get("title", ""),
                "channel": item["snippet"].get("channelTitle", ""),
                "seconds": parse_duration(item["contentDetails"].get("duration", "")),
                "live": item["snippet"].get("liveBroadcastContent", "none"),
                "views": int(item.get("statistics", {}).get("viewCount", 0) or 0),
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
    """Anything over 3 minutes can't be a Short. Otherwise: youtube.com/shorts/ID loads
    for a Short and redirects for a regular video. If YouTube won't answer, fall back
    to length (Shorts are 3 minutes or less)."""
    if seconds > SHORT_MAX_SECONDS:
        return "long"
    time.sleep(0.2)  # go easy on YouTube when checking a lot of videos at once
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
    avatars = dict(cache.get("avatars", {}))
    old_videos = existing.get("recent", [])
    failures = 0

    now = datetime.now(timezone.utc)
    last_full = cache.get("full_sync")
    full = True
    if last_full:
        try:
            full = now - datetime.fromisoformat(last_full) >= timedelta(hours=FULL_SYNC_HOURS)
        except ValueError:
            pass
    print("FULL sync: reading every upload" if full else "Quick sync: newest uploads only")

    videos, fetched_ids = [], set()
    all_ok = True
    for label, handle in CHANNELS:
        old = [v for v in old_videos if v.get("channel") == label]
        try:
            if handle not in playlists:
                playlists[handle] = channel_uploads_playlist(handle)
                print(f"@{handle} -> uploads playlist {playlists[handle]}")
            got = channel_uploads(playlists[handle], label, everything=full)
            print(f"{label}: {len(got)} uploads fetched")
            fetched_ids |= {v["id"] for v in got}
            if full:
                videos.extend(got)              # the whole list, straight from YouTube
            else:
                newer = {v["id"]: v for v in got}
                videos.extend(newer.values())    # newest (fresh titles)...
                videos.extend(v for v in old if v["id"] not in newer)  # ...plus everything saved
        except Exception as e:
            failures += 1
            all_ok = False
            print(f"WARNING: {label} (@{handle}) failed: {e}", file=sys.stderr)
            videos.extend(old)

    seen = {}
    for v in videos:
        seen[v["id"]] = v
    videos = sorted(seen.values(), key=lambda v: v["published"], reverse=True)

    best_ids = read_best_ids()

    # Details (length, live status) for what we just fetched, plus best-video titles.
    # Old saved videos don't need looking up again.
    details = {}
    try:
        details = video_details(fetched_ids | set(best_ids))
    except Exception as e:
        print(f"WARNING: video details failed: {e}", file=sys.stderr)

    # drop upcoming premieres / live streams that haven't happened yet
    videos = [v for v in videos if details.get(v["id"], {}).get("live") != "upcoming"]

    new_types = 0
    for v in videos:
        if v["id"] not in types:
            t = detect_type(v["id"], details.get(v["id"], {}).get("seconds", 0))
            if t:
                types[v["id"]] = t
                new_types += 1
        v["type"] = types.get(v["id"], "unknown")
        # fresh views for what we just looked up; older saved videos keep theirs until the daily full sync
        if v["id"] in details:
            v["views"] = details[v["id"]]["views"]
    if new_types:
        print(f"Sorted {new_types} new videos into Shorts / long-form")

    try:
        got = channel_avatars(playlists)
        avatars.update(got)
    except Exception as e:
        print(f"WARNING: profile pictures failed: {e}", file=sys.stderr)

    best = []
    for vid in best_ids:
        d = details.get(vid, {})
        best.append({"id": vid, "title": d.get("title", ""), "channel": d.get("channel", "")})

    keep = {v["id"] for v in videos}
    data = {
        "channels": {label: {"handle": handle, "avatar": avatars.get(handle, "")}
                     for label, handle in CHANNELS},
        "best": best,
        "recent": videos,
        "_cache": {
            "playlists": playlists,
            "avatars": avatars,
            "types": {k: t for k, t in types.items() if k in keep},
            # only count a full sync as done if every channel worked
            "full_sync": now.isoformat(timespec="seconds") if (full and all_ok) else last_full,
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
        return {k: d.get(k) for k in ("channels", "best", "recent", "_cache")}

    if comparable(data) != comparable(existing):
        data["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        ordered = {"updated": data["updated"], "channels": data["channels"],
                   "best": data["best"], "recent": data["recent"], "_cache": data["_cache"]}
        OUT_FILE.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
        print(f"Wrote {len(data['recent'])} videos and {len(data['best'])} best videos.")
    else:
        print("No changes.")

    if failures == len(CHANNELS):
        sys.exit("ERROR: every channel failed. See the warnings above.")


if __name__ == "__main__":
    main()
