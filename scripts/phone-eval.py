#!/usr/bin/env python3
"""Evaluates JavaScript in the Shelvve tab of Chrome on the phone (Chrome DevTools protocol over adb).
Usage: scripts/phone-eval.py '<expression>'  |  scripts/phone-eval.py - < expr.js (long expressions)  |  scripts/phone-eval.py --shot out.png
Targets the dev tab (localhost:4300, see phone.sh); SHELVVE_URL=piotrc33.github.io/shelvve targets the installed app.
Standard library only: a minimal WebSocket client (no `websockets` package to install on each laptop)."""
import base64, json, os, socket, struct, subprocess, sys, urllib.parse, urllib.request

def websocket(url):
    """Connects to a ws:// [url]; returns the socket after the handshake."""
    u = urllib.parse.urlparse(url)
    sock = socket.create_connection((u.hostname, u.port))
    key = base64.b64encode(os.urandom(16)).decode()
    sock.sendall((f"GET {u.path} HTTP/1.1\r\nHost: {u.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                  f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    response = b""
    while b"\r\n\r\n" not in response:
        response += sock.recv(1)
    if b" 101 " not in response.split(b"\r\n")[0]:
        sys.exit(f"WebSocket handshake failed: {response.decode(errors='replace')}")
    return sock

def read_exactly(sock, n):
    data = b""
    while len(data) < n:
        chunk = sock.recv(n - len(data))
        if not chunk:
            sys.exit("WebSocket closed")
        data += chunk
    return data

def send_text(sock, text):
    payload, mask = text.encode(), os.urandom(4)  # client frames must be masked
    n = len(payload)
    header = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else
                              bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else
                              bytes([0x80 | 127]) + struct.pack(">Q", n))
    sock.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

def receive_text(sock):
    """One whole message (DevTools results can come in continuation frames)."""
    message = b""
    while True:
        first, second = read_exactly(sock, 2)
        n = second & 0x7F
        if n == 126:
            n = struct.unpack(">H", read_exactly(sock, 2))[0]
        elif n == 127:
            n = struct.unpack(">Q", read_exactly(sock, 8))[0]
        payload = read_exactly(sock, n)
        if first & 0x0F == 0x8:
            sys.exit("WebSocket closed")
        if first & 0x0F in (0x0, 0x1):
            message += payload
            if first & 0x80:
                return message.decode()

def call(ws_url, method, params):
    sock = websocket(ws_url)
    send_text(sock, json.dumps({"id": 1, "method": method, "params": params}))
    while True:
        msg = json.loads(receive_text(sock))
        if msg.get("id") == 1:
            sock.close()
            return msg.get("result", msg)

if __name__ == "__main__":
    URL_PART = os.environ.get("SHELVVE_URL", "localhost:4300")
    ADB = os.path.expanduser("~/Android/Sdk/platform-tools/adb")
    # Chrome's own DevTools socket (not a WebView's): the app runs as a tab or installed PWA in Chrome.
    subprocess.run([ADB, "forward", "tcp:9334", "localabstract:chrome_devtools_remote"], check=True, capture_output=True)
    pages = json.load(urllib.request.urlopen("http://127.0.0.1:9334/json"))
    page = next(p for p in pages if p["type"] == "page" and URL_PART in p["url"])
    if sys.argv[1] == "--shot":
        r = call(page["webSocketDebuggerUrl"], "Page.captureScreenshot", {"format": "png"})
        open(sys.argv[2], "wb").write(base64.b64decode(r["data"]))
        print(sys.argv[2])
    else:
        r = call(page["webSocketDebuggerUrl"], "Runtime.evaluate",
                 {"expression": sys.stdin.read() if sys.argv[1] == "-" else sys.argv[1], "returnByValue": True, "awaitPromise": True})
        print(json.dumps(r.get("result", {}).get("value", r), ensure_ascii=False, indent=1))
