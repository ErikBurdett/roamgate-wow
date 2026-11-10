import path from 'node:path';
import os from 'node:os';
export function serviceUnit(root, node) {
  if (!path.isAbsolute(root) || !path.isAbsolute(node) || /[\r\n]/.test(root + node)) throw Error('Invalid service path');
  const searchPath = [...new Set([path.dirname(node), path.join(os.homedir(), '.local/bin'), ...(process.env.PATH || '').split(':').filter(p => path.isAbsolute(p) && !/[\r\n\0]/.test(p)), '/usr/local/bin', '/usr/bin', '/bin'])].join(':');
  const quote = s => '"' + s.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%') + '"';
  return `# Owner: ${root}\n[Unit]\nDescription=Roamgate in World of Warcraft\nAfter=herdr.service roamgate.service\n\n[Service]\nType=simple\nWorkingDirectory=${root.replaceAll('%', '%%')}\nExecStart=${quote(node)} ${quote(path.join(root, 'bridge/main.mjs'))} run\nEnvironment=${quote('PATH=' + searchPath)}\nUMask=0077\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=20\n\n[Install]\nWantedBy=default.target\n`;
}
