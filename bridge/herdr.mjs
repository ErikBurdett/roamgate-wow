import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { modelArgs, MODEL_CHOICES } from './models.mjs';
const exec = promisify(execFile);
export class Herdr {
  constructor({modelChoices=MODEL_CHOICES}={}) {this.modelChoices=modelChoices;}
  async command(args, { text = false, timeout = 12000 } = {}) {
    let stdout;
    try { ({ stdout } = await exec('herdr', args, { timeout, maxBuffer: 3 * 1024 * 1024, env: process.env })); }
    catch (e) {
      // Do not echo command-line arguments: messages may contain private text.
      try { const err = JSON.parse(e.stderr); if (err.error?.message) throw Object.assign(Error(err.error.message), { safe: true }); }
      catch (inner) { if (inner.safe) throw inner; }
      throw Error(e.killed ? 'Herdr timed out; delivery is uncertain. Inspect the session before sending again.' : 'Herdr request failed');
    }
    if (text) return stdout;
    const result = JSON.parse(stdout); if (result.error) throw Error(result.error.message);
    return result.result;
  }
  async agents() { return (await this.command(['agent', 'list'])).agents; }
  async workspaces() { return (await this.command(['workspace', 'list'])).workspaces; }
  async panes() { return (await this.command(['pane', 'list'])).panes; }
  async tabs() { return (await this.command(['tab', 'list'])).tabs; }
  async pane(pane) { const panes = await this.panes(); const found = panes.find(p => p.pane_id === pane); if (!found) throw Error('This pane is no longer available'); return found; }
  readPane(pane) { return this.command(['pane', 'read', pane, '--source', 'recent-unwrapped', '--lines', '220', '--format', 'text'], { text: true }); }
  async get(pane) { return (await this.command(['agent', 'get', pane])).agent; }
  read(pane, visible = true) { return this.command(['agent', 'read', pane, '--source', visible ? 'visible' : 'recent-unwrapped', '--lines', visible ? '90' : '220', '--format', 'text'], { text: true }); }
  prompt(pane, text) { return this.command(['agent', 'prompt', pane, text]); }
  key(pane, key) { return this.command(['agent', 'send-keys', pane, key]); }
  async answer(pane, text) {
    // A literal paste into the already-reviewed question. The Enter is a
    // separate deliberate operation in the UI, never an automatic approval.
    return this.command(['pane', 'send-text', pane, text]);
  }
  async newChat(agent, text, kind, model = '') {
    const args = modelArgs(kind, model,this.modelChoices); // Validate before creating anything.
    const made = await this.command(['tab', 'create', '--workspace', agent.workspace_id, '--cwd', agent.foreground_cwd || agent.cwd, '--label', 'From Azeroth', '--no-focus']);
    const pane = made.root_pane.pane_id;
    try {
      await this.command(['agent', 'start', `wow-${Date.now().toString(36)}`, '--kind', kind, '--pane', pane, ...args], { timeout: 40000 });
      await this.prompt(pane, text);
    } catch { throw Error(`Created ${pane}, but startup or delivery was not confirmed. Inspect that pane in Roamgate before retrying.`); }
    return pane;
  }
}
