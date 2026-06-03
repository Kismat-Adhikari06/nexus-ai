import ctypes
import os
import subprocess

import psutil

from nexu_log import get_logger

log = get_logger("system")


def _launch_new_console(exe: str):
    CREATE_NEW_CONSOLE = 0x00000010
    subprocess.Popen(exe, creationflags=CREATE_NEW_CONSOLE)


def launch_app(name: str, admin: bool = False) -> str:
    apps = {
        "chrome": "chrome",
        "firefox": "firefox",
        "edge": "msedge",
        "notepad": "notepad",
        "calculator": "calc",
        "calendar": "outlookcal:",
        "cmd": "cmd",
        "command prompt": "cmd",
        "terminal": "wt",
        "whatsapp": "https://web.whatsapp.com",
    }
    exe = apps.get(name.lower(), name)
    try:
        if admin:
            ctypes.windll.shell32.ShellExecuteW(None, "runas", exe, None, None, 1)
        elif exe.startswith(("http://", "https://")):
            subprocess.Popen(["cmd", "/c", "start", exe], shell=True)
        elif name.lower() in ("cmd", "command prompt"):
            _launch_new_console("cmd")
        elif name.lower() == "terminal":
            _launch_new_console("wt")
        elif name.lower() == "calendar":
            subprocess.Popen(["explorer", "shell:AppsFolder\\microsoft.windowscommunicationsapps_8wekyb3d8bbwe!microsoft.windowslive.calendar"])
        else:
            subprocess.Popen(exe, shell=True)
        log.info("Launched: %s", name)
        return f"Launched {name}"
    except Exception as e:
        log.error("Failed to launch %s: %s", name, e)
        return f"Failed to launch {name}: {e}"


def get_battery() -> str:
    battery = psutil.sensors_battery()
    if battery is None:
        return "No battery detected"
    pct = battery.percent
    plug = "plugged in" if battery.power_plugged else "on battery"
    return f"Battery at {pct}%, {plug}"


def get_cpu() -> str:
    return f"CPU usage: {psutil.cpu_percent(interval=0.5)}%"


def get_ram() -> str:
    mem = psutil.virtual_memory()
    used_gb = mem.used / 1e9
    total_gb = mem.total / 1e9
    return f"RAM: {used_gb:.1f}GB / {total_gb:.1f}GB ({mem.percent}%)"


def set_volume(level: int) -> str:
    level = max(0, min(100, level))
    try:
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        volume.SetMasterVolumeLevelScalar(level / 100.0, None)
        return f"Volume set to {level}%"
    except Exception as e:
        log.error("Failed to set volume: %s", e)
        return f"Failed to set volume: {e}"


def notify(title: str, message: str) -> str:
    try:
        from plyer import notification
        notification.notify(title=title, message=message, timeout=5)
        return f"Notification sent: {title}"
    except Exception as e:
        log.error("Failed to send notification: %s", e)
        return f"Failed to send notification: {e}"


def run_command(command: str) -> str:
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=10)
        out = result.stdout.strip()
        err = result.stderr.strip()
        if out:
            return out[:500]
        if err:
            return f"Error: {err[:500]}"
        return "Command ran successfully"
    except subprocess.TimeoutExpired:
        return "Command timed out"
    except Exception as e:
        log.error("Command failed: %s", e)
        return f"Failed: {e}"
