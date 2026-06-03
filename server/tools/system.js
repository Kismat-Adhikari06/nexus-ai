const { execSync } = require('child_process');
const os = require('os');

function _exec(cmd, timeout = 5000) {
  try {
    return execSync(cmd, { timeout, encoding: 'utf-8', shell: true });
  } catch {
    return '';
  }
}

function getBattery() {
  // Method 1: WMIC
  try {
    const out = _exec('WMIC PATH Win32_Battery Get EstimatedChargeRemaining, BatteryStatus /Format:CSV');
    const lines = out.trim().split('\n').filter(l => l && !l.toUpperCase().includes('NODE'));
    if (lines.length > 0) {
      const parts = lines[lines.length - 1].split(',');
      const pct = parts[2]?.trim();
      const status = parts[1]?.trim();
      if (pct) {
        const plug = status === '2' ? 'plugged in' : 'on battery';
        return `Battery at ${pct}%, ${plug}`;
      }
    }
  } catch { /* fall through */ }

  // Method 2: PowerShell
  try {
    const ps = _exec('powershell -command "(Get-WmiObject Win32_Battery).EstimatedChargeRemaining"');
    const pct = ps?.trim();
    if (pct && !isNaN(parseFloat(pct))) {
      const psStatus = _exec('powershell -command "(Get-WmiObject Win32_Battery).BatteryStatus"');
      const plug = psStatus?.trim() === '2' ? 'plugged in' : 'on battery';
      return `Battery at ${pct}%, ${plug}`;
    }
  } catch { /* fall through */ }

  // Method 3: Check if it's a desktop with no battery
  try {
    const chassis = _exec('WMIC PATH Win32_SystemEnclosure Get ChassisTypes /Format:CSV');
    if (chassis.includes('3') || chassis.includes('4') || chassis.includes('5') || chassis.includes('6')) {
      return 'Desktop computer — no battery detected';
    }
  } catch { /* ignore */ }

  return 'No battery detected';
}

function getCpu() {
  const cpus = os.cpus();
  const model = cpus[0]?.model || 'Unknown';
  const cores = cpus.length;
  try {
    const out = _exec('WMIC PATH Win32_Processor Get LoadPercentage /Format:CSV');
    const lines = out.trim().split('\n').filter(l => l && !l.toUpperCase().includes('NODE'));
    const loadPct = lines.length > 0 ? lines[lines.length - 1].split(',')[1]?.trim() : '?';
    return `CPU: ${model} (${cores} cores), Usage: ${loadPct || '?'}%`;
  } catch {
    return `CPU: ${model} (${cores} cores)`;
  }
}

function getRam() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usedGb = (used / 1e9).toFixed(1);
  const totalGb = (total / 1e9).toFixed(1);
  const pct = ((used / total) * 100).toFixed(1);
  return `RAM: ${usedGb}GB / ${totalGb}GB (${pct}%)`;
}

function setVolume(level) {
  const lvl = Math.max(0, Math.min(100, parseInt(level)));
  try {
    for (let i = 0; i < 50; i++) {
      _exec('powershell -command "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"');
    }
    for (let i = 0; i < Math.floor(lvl / 2); i++) {
      _exec('powershell -command "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"');
    }
    return `Volume set to ${lvl}%`;
  } catch {
    return `Volume setting requires Windows audio API`;
  }
}

function notify(title, message) {
  try {
    const safeMsg = message.replace(/"/g, '`"');
    const safeTitle = title.replace(/"/g, '`"');
    _exec(`powershell -command "$t = New-Object -ComObject WScript.Shell; $t.Popup(\\"${safeMsg}\\", 5, \\"${safeTitle}\\", 0)"`, 5000);
    return `Notification sent: ${title}`;
  } catch (e) {
    return `Failed to send notification: ${e.message}`;
  }
}

function runCommand(command) {
  try {
    const result = execSync(command, { timeout: 10000, encoding: 'utf-8', shell: true });
    const out = result?.trim() || '';
    return out.substring(0, 500) || 'Command ran successfully';
  } catch (e) {
    return `Error: ${(e.stderr || e.message || '').substring(0, 500)}`;
  }
}

function launchApp(name) {
  const apps = {
    chrome: 'chrome', firefox: 'firefox', edge: 'msedge',
    notepad: 'notepad', calculator: 'calc',
    cmd: 'cmd', terminal: 'wt',
    whatsapp: 'https://web.whatsapp.com',
  };
  const exe = apps[name.toLowerCase()] || name;
  try {
    execSync(`cmd /c start "" "${exe}"`, { shell: true, timeout: 5000 });
    return `Launched ${name}`;
  } catch (e) {
    return `Failed to launch ${name}: ${e.message}`;
  }
}

function lockWorkstation() {
  try {
    _exec('rundll32.exe user32.dll,LockWorkStation');
    return 'Locked your workstation';
  } catch (e) {
    return `Failed to lock: ${e.message}`;
  }
}

function sleep() {
  try {
    _exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
    return 'Putting computer to sleep';
  } catch (e) {
    return `Failed to sleep: ${e.message}`;
  }
}

function shutdown() {
  try {
    _exec('shutdown /s /t 5');
    return 'Shutting down in 5 seconds';
  } catch (e) {
    return `Failed to shutdown: ${e.message}`;
  }
}

function hibernate() {
  try {
    _exec('shutdown /h');
    return 'Hibernating';
  } catch (e) {
    return `Failed to hibernate: ${e.message}`;
  }
}

module.exports = {
  getBattery, getCpu, getRam, setVolume, notify, runCommand, launchApp,
  lockWorkstation, sleep, shutdown, hibernate,
};
