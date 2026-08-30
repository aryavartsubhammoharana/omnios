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


def launch_public_tunnel(port: int = 8000, subdomain: str = "noteai-live"):
    try:
        ip_pass = requests.get("https://loca.lt/mytunnelpassword", timeout=3).text.strip()
    except Exception:
        ip_pass = "Run 'curl https://loca.lt/mytunnelpassword'"

    npx_cmd = shutil.which("npx") or "npx"
    tunnel_cmd = f"{npx_cmd} localtunnel --port {port} --subdomain {subdomain}"
    try:
        proc = subprocess.Popen(tunnel_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
        atexit.register(lambda: proc.kill())
    except Exception:
        pass

    tunnel_url = f"https://{subdomain}.loca.lt"
    print("=" * 72)
    print(f"🚀 NoteAI Local Server:   http://127.0.0.1:{port}")
    print(f"🌐 Public Live Tunnel:    {tunnel_url}")
    print(f"🔑 Tunnel Password (IP):  {ip_pass}")
    print("=" * 72)


if __name__ == "__main__":
    launch_public_tunnel(port=8000, subdomain="noteai-live")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
