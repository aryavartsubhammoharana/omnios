import sys
import shutil
import atexit
import subprocess
import requests
import uvicorn
from app.main import app

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def launch_public_tunnel(port: int = 8000, subdomain: str = "noteai-app"):
    import time
    import re

    try:
        ip_pass = requests.get("https://loca.lt/mytunnelpassword", timeout=3).text.strip()
    except Exception:
        ip_pass = "Run 'curl https://loca.lt/mytunnelpassword'"

    npx_cmd = shutil.which("npx") or "npx.cmd"
    tunnel_url = None

    try:
        tunnel_proc = subprocess.Popen(
            [npx_cmd, "localtunnel", "--port", str(port), "--subdomain", subdomain],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=True
        )
        atexit.register(lambda: tunnel_proc.kill())

        for _ in range(40):
            line = tunnel_proc.stdout.readline()
            if not line:
                time.sleep(0.1)
                continue
            match = re.search(r"https://[a-zA-Z0-9-]+\.loca\.lt", line)
            if match:
                tunnel_url = match.group(0)
                break
    except Exception:
        pass

    if not tunnel_url:
        tunnel_url = f"https://{subdomain}.loca.lt"

    print("=" * 74)
    print(f"🚀 NoteAI Local Server:   http://127.0.0.1:{port}")
    print(f"🌐 Public Live Tunnel:    {tunnel_url}")
    print(f"🔑 Tunnel Password (IP):  {ip_pass}")
    print("=" * 74)


if __name__ == "__main__":
    launch_public_tunnel(port=8000, subdomain="noteai-app")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
