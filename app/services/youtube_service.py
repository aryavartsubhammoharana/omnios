import os
import re
import urllib.parse
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from app.config import settings

JUNK_KEYWORDS = [
    "#short", "#shorts", "shorts", "status", "reel", "reels", "tiktok",
    "hot", "beautiful", "dance", "prank", "funny", "memes", "roast",
    "bgmi", "gaming", "reaction", "whatsapp status", "teacher entry",
    "cute mam", "cute sir", "mam pw", "sir pw funny", "fan club",
    "edit", "vlog", "trailer"
]

def is_academic_video(title: str, channel: str) -> bool:
    if not title:
        return False
    lower_title = title.lower()
    lower_channel = (channel or "").lower()

    for junk in JUNK_KEYWORDS:
        if junk in lower_title or junk in lower_channel:
            return False

    return True


def search_youtube_videos_via_api(query: str, max_results: int = 5) -> list[dict]:
    if not settings.YOUTUBE_API_KEY:
        return []
    try:
        url = "https://www.googleapis.com/youtube/v3/search"
        academic_query = f"{query} full lecture concept explanation"
        params = {
            "part": "snippet",
            "q": academic_query,
            "type": "video",
            "videoEmbeddable": "true",
            "videoDuration": "medium",
            "safeSearch": "strict",
            "relevanceLanguage": "en",
            "maxResults": max_results * 2,
            "key": settings.YOUTUBE_API_KEY.strip()
        }
        res = requests.get(url, params=params, timeout=10)
        if res.status_code == 200:
            items = res.json().get("items", [])
            videos = []
            for item in items:
                v_id = item["id"].get("videoId")
                if not v_id:
                    continue
                snippet = item["snippet"]
                title = snippet.get("title", "")
                channel = snippet.get("channelTitle", "")
                
                if not is_academic_video(title, channel):
                    continue

                videos.append({
                    "video_id": v_id,
                    "title": title,
                    "channel_title": channel,
                    "description": snippet.get("description", ""),
                    "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url", f"https://img.youtube.com/vi/{v_id}/hqdefault.jpg"),
                    "publish_time": snippet.get("publishTime", "")
                })
                if len(videos) >= max_results:
                    break
            return videos
    except Exception as e:
        print(f"YouTube Data API error: {e}")
    return []


def search_youtube_videos_fallback(query: str, max_results: int = 5) -> list[dict]:
    try:
        academic_query = f"{query} full lecture chapter explanation NCERT CBSE"
        encoded_query = urllib.parse.quote_plus(academic_query)
        url = f"https://www.youtube.com/results?search_query={encoded_query}&sp=EgIYAw%253D%253D"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            return []

        pattern = r'\"videoRenderer\":\s*\{\s*\"videoId\":\s*\"([^\"]+)\".*?\"title\":\s*\{\s*\"runs\":\s*\[\s*\{\s*\"text\":\s*\"([^\"]+)\".*?\"ownerText\":\s*\{\s*\"runs\":\s*\[\s*\{\s*\"text\":\s*\"([^\"]+)\"'
        matches = re.findall(pattern, res.text)
        
        seen = set()
        videos = []
        for match in matches:
            v_id, title, channel = match
            if v_id in seen:
                continue

            if not is_academic_video(title, channel):
                continue

            seen.add(v_id)
            videos.append({
                "video_id": v_id,
                "title": title,
                "channel_title": channel,
                "description": f"Masterclass lecture on {query}",
                "thumbnail_url": f"https://img.youtube.com/vi/{v_id}/hqdefault.jpg",
                "publish_time": ""
            })
            if len(videos) >= max_results:
                break
        return videos
    except Exception as e:
        print(f"YouTube search fallback note: {e}")
    return []


def get_curated_weak_topic_videos(weak_topics: list[str], grade_context: str = "", target_count: int = 10, seed_offset: int = 0) -> list[dict]:
    if not weak_topics:
        weak_topics = ["Fundamental Concepts", "Problem Solving Technique"]

    results = []
    seen_ids = set()

    search_templates = [
        "{topic} {grade} full chapter one shot lecture",
        "{topic} complete concept explanation animated masterclass",
        "{topic} detailed derivation problems NCERT JEE NEET",
        "{topic} masterclass lecture Khan Academy Physics Wallah"
    ]

    template_idx = seed_offset % len(search_templates)
    current_template = search_templates[template_idx]

    videos_per_topic = max(2, (target_count // len(weak_topics)) + 1)

    for topic in weak_topics:
        search_query = current_template.format(topic=topic, grade=grade_context).strip()
        vids = search_youtube_videos_via_api(search_query, max_results=videos_per_topic)
        if not vids or len(vids) < videos_per_topic:
            extra = search_youtube_videos_fallback(search_query, max_results=videos_per_topic)
            vids.extend(extra)

        for v in vids:
            if v["video_id"] not in seen_ids:
                seen_ids.add(v["video_id"])
                v["weak_topic"] = topic
                results.append(v)
            if len(results) >= target_count:
                break
        if len(results) >= target_count:
            break

    if len(results) < target_count:
        for topic in weak_topics:
            alt_template = search_templates[(template_idx + 1) % len(search_templates)]
            alt_query = alt_template.format(topic=topic, grade=grade_context).strip()
            extra = search_youtube_videos_fallback(alt_query, max_results=target_count - len(results))
            for v in extra:
                if v["video_id"] not in seen_ids:
                    seen_ids.add(v["video_id"])
                    v["weak_topic"] = topic
                    results.append(v)
                if len(results) >= target_count:
                    break
            if len(results) >= target_count:
                break

    return results[:target_count]


def get_video_transcript(video_id: str) -> list[dict]:
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(
            video_id,
            languages=['en', 'en-US', 'en-GB', 'hi', 'hi-IN', 'auto']
        )
        formatted = []
        for entry in transcript_list:
            formatted.append({
                "start": round(entry.get("start", 0.0), 1),
                "duration": round(entry.get("duration", 0.0), 1),
                "text": entry.get("text", "").strip()
            })
        return formatted
    except Exception as e:
        print(f"Transcript note for video {video_id}: {e}")
        return []
