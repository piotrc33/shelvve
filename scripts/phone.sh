#!/usr/bin/env bash
# Dev loop on the phone: `ng serve` on :4300, forwarded over USB with adb reverse, opened in the phone's Chrome.
# The phone loads http://localhost:4300: Chrome treats localhost as a secure context (needed by crypto.randomUUID()),
# a LAN address is not one. Port 4300, not 4200: each origin has its own IndexedDB and the old Półka app used 4200.
# This dev origin also keeps test books away from the real library at the GitHub Pages address.
set -euo pipefail
ADB="${ADB:-$HOME/Android/Sdk/platform-tools/adb}"
PORT=4300
"$ADB" reverse tcp:$PORT tcp:$PORT >/dev/null
(
  until curl -sf -o /dev/null "http://localhost:$PORT"; do sleep 0.5; done
  "$ADB" shell am start -a android.intent.action.VIEW -d "http://localhost:$PORT" com.android.chrome >/dev/null
) &
exec npx ng serve --port $PORT --host 127.0.0.1
