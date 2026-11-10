import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

export class Roamgate {
  constructor({ origin = 'http://127.0.0.1:8787', home = os.homedir() } = {}) {
    const url = new URL(origin);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:') throw Error('Roamgate must be on local HTTP loopback');
    this.origin = url.origin; this.home = home; this.pending = new Map(); this.serial = 0;
  }
  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (Date.now() < (this.retryAt || 0)) throw Error('Roamgate reconnect pending');
    this.retryAt = Date.now() + 30000;
    const dir = path.join(this.home, '.config/roamgate');
    let password;
    try {
      const env = await fs.readFile(path.join(dir, 'roamgate.env'), 'utf8');
      const line = env.split('\n').find(l => /^(?:ROAMGATE_PASSWORD|HERDR_GUI_PASSWORD)=/.test(l));
      if (line) { password = line.slice(line.indexOf('=') + 1).trim(); if (/^(['"]).*\1$/.test(password)) password = password.slice(1, -1); }
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
    password ||= (await fs.readFile(path.join(dir, 'auth-token'), 'utf8')).trim();
    const response = await fetch(`${this.origin}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: this.origin },
      body: JSON.stringify({ password }), signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    if (!response.ok) throw Error(`Roamgate login failed (${response.status}); credentials were not logged`);
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw Error('Roamgate did not issue a session cookie');
    const ws = this.ws = new WebSocket(this.origin.replace('http:', 'ws:') + '/ws', { headers: { Cookie: cookie, Origin: this.origin }, handshakeTimeout: 5000, maxPayload: 8 * 1024 * 1024 });
    ws.on('message', raw => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(msg.id);
      if (msg.error) pending.reject(Error(msg.error.message || 'Roamgate rejected the request'));
      else pending.resolve(msg.result);
    });
    ws.on('close', () => {
      for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(Error('Roamgate disconnected')); }
      this.pending.clear();
    });
    ws.on('error', () => {});
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', () => reject(Error('Roamgate connection failed'))); });
    this.retryAt = 0;
    // Explicitly bind to the built-in local profile; never follow a browser's
    // currently selected SSH machine when pane IDs could overlap.
    const listing = await this.call('connections.list', {}, false);
    const profiles = listing.connections || listing.profiles || [];
    const expected = path.join(this.home, '.config/herdr/herdr.sock');
    const local = profiles.find(c => c.type === 'local' && c.control_socket_path === expected && c.state === 'ready');
    if (!local) { this.close(); throw Error('Cannot verify the local Roamgate connection'); }
    this.connection = local.id;
  }
  call(method, params = {}, scoped = true) {
    if (this.ws?.readyState !== WebSocket.OPEN) return Promise.reject(Error('Roamgate disconnected'));
    if (scoped && !this.connection) return Promise.reject(Error('Local connection not verified'));
    const id = `wow:${++this.serial}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('Roamgate request timed out')); }, 8000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, ...(scoped ? { connection_id: this.connection } : {}) }));
    });
  }
  async history(pane) { await this.connect(); return this.call('agent_history.get', { pane_id: pane, history_version: 2 }); }
  async browse(workspace, view, requestedPath = '') {
    if (requestedPath.startsWith('/') || requestedPath.split('/').includes('..') || /[\x00-\x1f]/.test(requestedPath) || requestedPath.length > 4096) throw Error('Invalid workspace path');
    await this.connect();
    const params = { workspace_id: workspace, path: requestedPath, mode: 'working' };
    let method;
    if (view === 'files') method = 'file.list';
    else if (view === 'file') method = 'file.read';
    else if (view === 'changes') method = 'git.diff_summary';
    else if (view.startsWith('diff:') && ['staged', 'unstaged', 'untracked', 'conflicted'].includes(view.slice(5))) { method = 'git.diff_file'; params.kind = view.slice(5); }
    else throw Error('Unsupported browser view');
    const result = await this.call(method, params);
    const content = result.text ?? result.diff;
    return { view, path: requestedPath, root: result.root || '', truncated: result.truncated || (content?.length > 60000), binary: !!result.binary,
      text: typeof content === 'string' ? content.slice(0, 60000) : '', entries: (result.entries || []).slice(0, 500).map(e => ({ name: e.name || e.path, path: e.path, type: e.type || 'diff', kind: e.kind || '', status: e.status || '', additions: e.additions, deletions: e.deletions })),
    };
  }
  close() { this.ws?.close(); }
}
