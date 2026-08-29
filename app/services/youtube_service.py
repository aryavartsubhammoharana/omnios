import os
import re
import json
import urllib.parse
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from app.config import settings

JUNK_KEYWORDS = [
    "#short", "#shorts", "shorts", "status", "reel", "reels", "tiktok",
    "hot", "beautiful", "dance", "prank", "funny", "memes", "roast",
    "bgmi", "gaming", "reaction", "whatsapp status", "teacher entry",
    "cute mam", "cute sir", "mam pw", "sir pw funny", "fan club",
    "edit", "vlog", "trailer", "short feed", "ytshorts"
]

TRUSTED_CHANNELS = [
    "Khan Academy", "Physics Wallah", "Unacademy", "Vedantu", "CrashCourse",
    "Amoeba Sisters", "MIT OpenCourseWare", "NPTEL", "Professor Dave Explains",
    "The Organic Chemistry Tutor", "Magnet Brains", "LearnOhub", "Apni Kaksha",
    "3Blue1Brown", "Veritasium", "Bozeman Science", "Freesciencelessons", "Dr. Hope's Sick Notes"
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


def expand_academic_queries_with_ai(topic: str, grade_context: str = "") -> list[str]:
    from app.services.ai import query_groq_ai

    prompt = (
        f"Generate 3 highly specific, academic YouTube search queries for a student struggling with the topic: '{topic}'.\n"
        f"Student Grade/Context: '{grade_context or 'High School / Pre-Medical / Engineering'}'\n"
        f"Include relevant terms like chapter name, NCERT, one shot, animated explanation, or top educational channels.\n"
        f"Return ONLY a JSON array of 3 strings. Example: [\"Fluid Mechanics one shot class 11 physics wallah\", \"Transport in Plants biology Khan Academy\", \"Body Fluids and Circulation full lecture\"]\n"
        f"No markdown, pure JSON only."
    )
    try:
        resp = query_groq_ai(prompt=prompt)
        cleaned = re.sub(r"^```json\s*", "", resp.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE).strip()
        match = re.search(r"\[\s*\".*?\"\s*\]", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)
        parsed = json.loads(cleaned)
        if isinstance(parsed, list) and len(parsed) > 0:
            return [str(q).strip() for q in parsed if str(q).strip()]
    except Exception as e:
        print(f"AI query expansion note: {e}")

    return [
        f"{topic} {grade_context} full chapter one shot lecture",
        f"{topic} concept explanation animated masterclass",
        f"{topic} complete derivation problems NCERT JEE NEET"
    ]


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
                    "publish_time": snippet.get("publishTime", ""),
                    "duration": "Lecture"
                })
                if len(videos) >= max_results:
                    break
            return videos
    except Exception as e:
        print(f"YouTube Data API error: {e}")
    return []


def search_youtube_videos_fallback(query: str, max_results: int = 5) -> list[dict]:
    try:
        academic_query = f"{query} lecture full chapter explanation"
        encoded_query = urllib.parse.quote_plus(academic_query)
        url = f"https://www.youtube.com/results?search_query={encoded_query}&sp=EgIYAw%253D%253D"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            return []

        pattern = r'\"videoRenderer\":\s*\{.*?\"videoId\":\s*\"([^\"]+)\".*?\"title\":\s*\{\s*\"runs\":\s*\[\s*\{\s*\"text\":\s*\"([^\"]+)\".*?\"ownerText\":\s*\{\s*\"runs\":\s*\[\s*\{\s*\"text\":\s*\"([^\"]+)\"'
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
                "description": f"Targeted lecture on {query}",
                "thumbnail_url": f"https://img.youtube.com/vi/{v_id}/hqdefault.jpg",
                "publish_time": "",
                "duration": "Full Lecture"
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

    all_queries = []
    for topic in weak_topics:
        expanded = expand_academic_queries_with_ai(topic, grade_context)
        for q in expanded:
            all_queries.append((topic, q))

    if seed_offset > 0 and len(all_queries) > 1:
        all_queries = all_queries[seed_offset % len(all_queries):] + all_queries[:seed_offset % len(all_queries)]

    for topic, query_str in all_queries:
        vids = search_youtube_videos_via_api(query_str, max_results=3)
        if not vids:
            vids = search_youtube_videos_fallback(query_str, max_results=3)

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
            fallback_query = f"{topic} NCERT class 11 12 full lecture one shot physics wallah khan academy"
            extra = search_youtube_videos_fallback(fallback_query, max_results=target_count - len(results))
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
