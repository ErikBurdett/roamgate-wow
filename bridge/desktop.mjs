import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WIDTH, HEIGHT, parsePPM, decodeCapture } from './protocol.mjs';
const exec = promisify(execFile);
export class Desktop {
  constructor() { this.env = { ...process.env }; this.lastWindow = 0; }
  async discover() {
    const runtime = this.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid()}`;
    this.env.XDG_RUNTIME_DIR = runtime;
    if (!this.env.HYPRLAND_INSTANCE_SIGNATURE) {
      const instances = await fs.readdir(`${runtime}/hypr`, { withFileTypes: true });
      const matches = [];
      for (const d of instances.filter(d => d.isDirectory())) {
        try { await fs.access(`${runtime}/hypr/${d.name}/.socket.sock`); matches.push(d.name); } catch {}
      }
      if (matches.length !== 1) throw Error('Cannot select a unique Hyprland session');
      this.env.HYPRLAND_INSTANCE_SIGNATURE = matches[0];
    }
    if (!this.env.WAYLAND_DISPLAY) {
      const displays = (await fs.readdir(runtime)).filter(n => /^wayland-\d+$/.test(n));
      if (displays.length !== 1) throw Error('Cannot select a unique Wayland display');
      this.env.WAYLAND_DISPLAY = displays[0];
    }
  }
  async window() {
    if (!this.env.HYPRLAND_INSTANCE_SIGNATURE) await this.discover();
    const { stdout } = await exec('hyprctl', ['-j', 'activewindow'], { env: this.env, timeout: 2500 });
    const w = JSON.parse(stdout);
    if (w.title !== 'World of Warcraft' || !w.mapped || w.hidden || !w.xwayland) return null;
    const monitors = JSON.parse((await exec('hyprctl', ['-j', 'monitors'], { env: this.env, timeout: 2500 })).stdout);
    w.captureScale = monitors.find(m => m.id === w.monitor)?.scale || 1;
    return w;
  }
  async capture() {
    if (Date.now() - this.lastWindow > 500) { this.current = await this.window(); this.lastWindow = Date.now(); }
    const w = this.current;
    if (!w || w.size[0] < WIDTH || w.size[1] < HEIGHT) return null;
    // Only the protocol strip is read; no full-screen image or clipboard is kept.
    const cw = Math.min(w.size[0], 1024), ch = 64;
    const { stdout } = await exec('grim', ['-t', 'ppm', '-s', String(w.captureScale), '-g', `${w.at[0]},${w.at[1]} ${cw}x${ch}`, '-'], { env: this.env, encoding: 'buffer', maxBuffer: 2 * 1024 * 1024, timeout: 2500 });
    const { rgb, width, height } = parsePPM(stdout);
    // XWayland can render at native DPI or let the compositor scale it.
    // Try both; the magic and two checksums still gate command decoding.
    const decoded = decodeCapture(rgb, width, height);
    if (decoded) this.lastFormat = decoded.format;
    return decoded?.frame || null;
  }
}
