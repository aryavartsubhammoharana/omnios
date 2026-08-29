import os
import re
import urllib.parse
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from app.config import settings

def search_youtube_videos_via_api(query: str, max_results: int = 5) -> list[dict]:
    if not settings.YOUTUBE_API_KEY:
        return []
    try:
        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "part": "snippet",
            "q": f"{query} lecture tutorial concept explanation",
            "type": "video",
            "videoEmbeddable": "true",
            "maxResults": max_results,
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
                videos.append({
                    "video_id": v_id,
                    "title": snippet.get("title", ""),
                    "channel_title": snippet.get("channelTitle", ""),
                    "description": snippet.get("description", ""),
                    "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url", f"https://img.youtube.com/vi/{v_id}/hqdefault.jpg"),
                    "publish_time": snippet.get("publishTime", "")
                })
            return videos
    except Exception as e:
        print(f"YouTube Data API error: {e}")
    return []


def search_youtube_videos_fallback(query: str, max_results: int = 5) -> list[dict]:
    try:
        encoded_query = urllib.parse.quote_plus(f"{query} educational explanation lecture")
        url = f"https://www.youtube.com/results?search_query={encoded_query}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            return []

        pattern = r'"videoRenderer":\s*\{\s*"videoId":\s*"([^"]+)".*?"title":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)".*?"ownerText":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"'
        matches = re.findall(pattern, res.text)
        
        seen = set()
        videos = []
        for match in matches:
            v_id, title, channel = match
            if v_id in seen:
                continue
            seen.add(v_id)
            videos.append({
                "video_id": v_id,
                "title": title,
                "channel_title": channel,
                "description": f"Targeted lecture on {query}",
                "thumbnail_url": f"https://img.youtube.com/vi/{v_id}/hqdefault.jpg",
                "publish_time": ""
            })
            if len(videos) >= max_results:
                break
        return videos
    except Exception as e:
        print(f"YouTube search fallback note: {e}")
    return []


def get_curated_weak_topic_videos(weak_topics: list[str], grade_context: str = "", target_count: int = 10) -> list[dict]:
    if not weak_topics:
        weak_topics = ["Fundamental Concepts", "Problem Solving Technique"]

    results = []
    seen_ids = set()

    videos_per_topic = max(2, target_count // len(weak_topics))

    for topic in weak_topics:
        search_query = f"{topic} {grade_context}".strip()
        vids = search_youtube_videos_via_api(search_query, max_results=videos_per_topic)
        if not vids:
            vids = search_youtube_videos_fallback(search_query, max_results=videos_per_topic)

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
        fallback_query = f"{weak_topics[0]} full chapter masterclass"
        extra = search_youtube_videos_fallback(fallback_query, max_results=target_count - len(results))
        for v in extra:
            if v["video_id"] not in seen_ids:
                seen_ids.add(v["video_id"])
                v["weak_topic"] = weak_topics[0]
                results.append(v)
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
