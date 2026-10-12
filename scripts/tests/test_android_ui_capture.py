"""Fault recovery must not hide failed captures. Author: Jonathan Kakesa (JonathanK-N)."""
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from android_ui_capture import capture_ui


class CaptureRecoveryTests(unittest.TestCase):
    def test_killed_capture_is_recorded_before_fresh_success(self):
        adb = Mock(side_effect=[subprocess.CalledProcessError(137, ["adb"]), "UI hierarchy dumped"])
        failures = []
        result = capture_ui(adb, "/sdcard/test.xml", failures.append, sleep=Mock())
        self.assertEqual(result, "UI hierarchy dumped")
        self.assertEqual(adb.call_count, 2)
        self.assertEqual(failures[0]["status"], "DRIVER_FAILURE")

    def test_unrelated_failure_is_never_retried(self):
        adb = Mock(side_effect=subprocess.CalledProcessError(1, ["adb"]))
        record = Mock()
        with self.assertRaises(subprocess.CalledProcessError):
            capture_ui(adb, "/sdcard/test.xml", record, sleep=Mock())
        self.assertEqual(adb.call_count, 1)
        record.assert_not_called()

    def test_persistent_capture_failure_remains_failure(self):
        adb = Mock(side_effect=subprocess.CalledProcessError(137, ["adb"]))
        failures = []
        with self.assertRaises(subprocess.CalledProcessError):
            capture_ui(adb, "/sdcard/test.xml", failures.append, sleep=Mock())
        self.assertEqual(adb.call_count, 3)
        self.assertEqual(len(failures), 3)


if __name__ == "__main__":
    unittest.main()
