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


def launch_public_tunnel(port: int = 8000):
    import time
    import re

    cf_bin = shutil.which("cloudflared") or "cloudflared.cmd"
    tunnel_url = None
    tunnel_proc = None

    if cf_bin:
        try:
            tunnel_proc = subprocess.Popen(
                [cf_bin, "tunnel", "--url", f"http://127.0.0.1:{port}"],
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
                match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
                if match:
                    tunnel_url = match.group(0)
                    break
        except Exception:
            pass

    if not tunnel_url:
        try:
            npx_cmd = shutil.which("npx") or "npx.cmd"
            tunnel_proc = subprocess.Popen(
                [npx_cmd, "localtunnel", "--port", str(port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                shell=True
            )
            atexit.register(lambda: tunnel_proc.kill())

            for _ in range(30):
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

    print("=" * 74)
    print(f"🚀 NoteAI Local Server:   http://127.0.0.1:{port}")
    if tunnel_url:
        print(f"🌐 Public Live Tunnel:    {tunnel_url}")
        print(f"⚡ Tunnel Status:         Active & Ready for All Devices (Mobile/PC)")
    else:
        print("🌐 Public Live Tunnel:    Connecting in background...")
    print("=" * 74)


if __name__ == "__main__":
    launch_public_tunnel(port=8000)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
