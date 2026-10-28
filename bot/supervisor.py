"""Keep upstream Iris running inside Redroid, including after server reboot."""
import hashlib
import os
from pathlib import Path
import subprocess
import time

apk = Path('/assets/Iris.apk')
expected = os.environ.get('IRIS_APK_SHA256', '')
if len(expected) != 64 or hashlib.sha256(apk.read_bytes()).hexdigest() != expected.lower():
    raise SystemExit('Iris APK SHA-256 mismatch. Obtain and verify the upstream release first.')

def adb(*args, **kwargs):
    return subprocess.run(['adb', '-s', 'redroid:5555', *args], timeout=60, check=True, **kwargs)

while True:
    try:
        subprocess.run(['adb', 'connect', 'redroid:5555'], timeout=15, check=True, stdout=subprocess.DEVNULL)
        if adb('shell', 'getprop', 'sys.boot_completed', capture_output=True, text=True).stdout.strip() != '1':
            time.sleep(5)
            continue
        running = adb('shell', 'ps -A -o ARGS', capture_output=True, text=True).stdout
        if 'app_process / party.qwer.iris.Main' in running:
            time.sleep(10)
            continue
        adb('push', str(apk), '/data/local/tmp/Iris.apk', stdout=subprocess.DEVNULL)
        # Upstream documented entry point; no personal device or host app required.
        process = subprocess.Popen(['adb', '-s', 'redroid:5555', 'shell',
                                   'CLASSPATH=/data/local/tmp/Iris.apk app_process / party.qwer.iris.Main'],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        process.wait()
    except Exception:
        print('Iris supervisor waiting for Redroid; no credentials logged.', flush=True)
    time.sleep(10)
