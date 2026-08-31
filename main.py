import sys
import shutil
import atexit
import subprocess
import uvicorn
from app.main import app

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def launch_public_tunnel(port: int = 8000):
    import time
    import re

    cloudflared_cmd = shutil.which("cloudflared")
    tunnel_url = None

    if not cloudflared_cmd:
        print("⚠️ 'cloudflared' is not installed or not in PATH.")
        print("=" * 74)
        print(f"🚀 OmniOS Local Server:   http://127.0.0.1:{port}")
        print("=" * 74)
        return

    try:
        # shell=False is often safer and works better for capturing cloudflared in some environments,
        # but shell=True is needed if cloudflared is resolved by the shell on Windows.
        tunnel_proc = subprocess.Popen(
            f"\"{cloudflared_cmd}\" tunnel --url http://127.0.0.1:{port}",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=True
        )
        atexit.register(lambda: tunnel_proc.kill())

        # Wait up to 10 seconds for the URL to appear in logs
        for _ in range(100):
            line = tunnel_proc.stdout.readline()
            if not line:
                time.sleep(0.1)
                continue
            
            match = re.search(r"https://(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com", line)
            if match:
                tunnel_url = match.group(0)
                break
    except Exception as e:
        print(f"Tunnel Error: {e}")

    print("=" * 74)
    print(f"🚀 OmniOS Local Server:   http://127.0.0.1:{port}")
    if tunnel_url:
        print(f"🌐 Cloudflare Tunnel:     {tunnel_url}")
    else:
        print("🌐 Cloudflare Tunnel:     Failed to fetch URL automatically.")
    print("=" * 74)


if __name__ == "__main__":
    launch_public_tunnel(port=8000)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
