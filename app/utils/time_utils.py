from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now() -> datetime:
    return datetime.now(IST).replace(tzinfo=None)

def get_ist_today_str() -> str:
    return get_ist_now().strftime("%Y-%m-%d")

def get_ist_formatted(dt: datetime = None) -> str:
    if dt is None:
        dt = get_ist_now()
    return dt.strftime("%d %b %Y, %I:%M %p IST")
