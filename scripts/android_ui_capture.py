"""Bounded recovery for a killed UI capture process. Author: Jonathan Kakesa (JonathanK-N)."""
import subprocess
import time


def capture_ui(adb, remote_path, record, sleep=time.sleep):
    """Retry only UiAutomation exit 137; all application checks remain with the caller."""
    for attempt in range(1, 4):
        try:
            return adb("shell", "uiautomator", "dump", remote_path)
        except subprocess.CalledProcessError as error:
            if error.returncode != 137:
                raise
            record({"capture": remote_path, "attempt": attempt,
                    "exitCode": 137, "status": "DRIVER_FAILURE"})
            if attempt == 3:
                raise
            sleep(1)
