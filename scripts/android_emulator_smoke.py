"""Installed debug APK smoke checks on an isolated CI emulator."""
import json
import subprocess
import time
from pathlib import Path
from PIL import Image

package = "cd.cognito.afrimarket.staging"
out = Path("android-emulator-evidence")
out.mkdir(exist_ok=True)
rows = []


def adb(*args):
    return subprocess.check_output(["adb", *args], stderr=subprocess.STDOUT, timeout=30).decode(errors="replace")


def check(name, success, detail=""):
    rows.append({"test":name,"status":"PASS" if success else "FAIL","detail":detail})
    if not success:
        raise AssertionError(name)


try:
    apk = next(Path("android-apk").glob("*.apk"))
    check("fresh APK install", "Success" in adb("install", str(apk)))
    adb("shell","am","start","-W","-n",package+"/cd.cognito.afrimarket.MainActivity")
    time.sleep(8)
    adb("shell","uiautomator","dump","/sdcard/afrimarket.xml")
    adb("pull","/sdcard/afrimarket.xml",str(out/"launch.xml"))
    xml = (out/"launch.xml").read_text()
    check("installed WebView renders AfriMarket", "AfriMarket" in xml)
    (out/"launch.png").write_bytes(subprocess.check_output(["adb","exec-out","screencap","-p"]))
    with Image.open(out/"launch.png") as screenshot:
        pixels = screenshot.convert("RGB").crop((0,0,screenshot.width,int(screenshot.height*.4)))
        green = sum(1 for rgb in pixels.getdata() if all(abs(c-t)<=5 for c,t in zip(rgb,(8,80,65))))
    check("historical dark green visible", green > 100, str(green)+" matching pixels")
    adb("shell", "svc", "wifi", "disable")
    adb("shell", "svc", "data", "disable")
    adb("shell", "am", "force-stop", package)
    adb("logcat", "-c")
    adb("shell", "am", "start", "-W", "-n", package+"/cd.cognito.afrimarket.MainActivity")
    for attempt in range(10):
        time.sleep(3)
        (out/"offline.png").write_bytes(subprocess.check_output(["adb", "exec-out", "screencap", "-p"], timeout=30))
        dump = adb("shell", "uiautomator", "dump", "/sdcard/afrimarket-offline.xml")
        (out/"offline-dump.log").write_text(dump)
        if "UI hierchary dumped" not in dump and "UI hierarchy dumped" not in dump:
            continue
        adb("pull", "/sdcard/afrimarket-offline.xml", str(out/"offline.xml"))
        if "AfriMarket" in (out/"offline.xml").read_text():
            break
    (out/"offline.png").write_bytes(subprocess.check_output(["adb", "exec-out", "screencap", "-p"]))
    check("bundled landing renders with Wi-Fi and mobile data disabled", (out/"offline.xml").exists() and "AfriMarket" in (out/"offline.xml").read_text())
    adb("shell", "svc", "wifi", "enable")
    adb("shell", "svc", "data", "enable")
    adb("shell","run-as",package,"mkdir","-p","files")
    adb("shell","run-as",package,"touch","files/phase2-marker")
    check("debug APK update", "Success" in adb("install","-r",str(apk)))
    check("app files preserved during update", "phase2-marker" in adb("shell","run-as",package,"ls","files/phase2-marker"))
    check("uninstall", "Success" in adb("uninstall",package))
    check("reinstall", "Success" in adb("install",str(apk)))
    marker = subprocess.run(["adb","shell","run-as",package,"cat","files/phase2-marker"],capture_output=True)
    check("old app files removed after uninstall", marker.returncode != 0)
    rows.append({"test":"physical device, iOS, authenticated sessions and hardware Back","status":"BLOCKED","detail":"Not covered by this installed-APK smoke test; offline coverage is limited to bundled landing"})
finally:
    (out/"results.json").write_text(json.dumps({"package":package,"rows":rows},indent=2))
    (out/"logcat.txt").write_text(adb("logcat","-d","-t","300"))
