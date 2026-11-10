import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { atomicWrite } from './files.mjs';
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const identity = a => JSON.stringify([a.pane_id, a.terminal_id, a.agent, a.agent_session || null, a.cwd]);
const visibleHash = text => hash(text.trimEnd());
const KEYS = new Set(['up', 'down', 'left', 'right', 'tab', 'space', 'enter', 'esc', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
export class Controller {
  constructor({ herdr, roamgate, journal, mode = 'interactive', slots = 2048, clock = Date.now }) {
    Object.assign(this, { herdr, roamgate, journal, mode, slots, clock }); this.proofs = new Map(); this.record = null; this.historyCache = new Map(); this.historyPending = new Map(); this.browserCache = new Map(); this.browserPending = new Set(); this.transcripts = new Map(); this.screens = new Map();
  }
  async init() {
    try { this.record = JSON.parse(await fs.readFile(this.journal, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw Error('Action journal is unreadable; refusing to replay requests'); }
  }
  async save() { await atomicWrite(this.journal, JSON.stringify(this.record)); }
  async handle(req) {
    if (req.slot < 1 || req.slot > this.slots) throw Error('Invalid update slot');
    if (this.record?.nonce !== req.nonce) {
      if (req.op !== 'view' || req.id !== 0) throw Error('Open the addon to establish a fresh connection first');
      this.record = { nonce: req.nonce, id: 0, state: 'ready', message: '', pane: '' }; await this.save();
    }
    if (req.op !== 'view' && req.id > this.record.id) {
      this.record = { nonce: req.nonce, id: req.id, state: 'uncertain', message: 'Delivery not confirmed. Inspect the agent before sending again.', pane: req.pane };
      await this.save(); // crash-safe, at-most-once: record BEFORE any mutation.
      try {
        const result = await this.act(req);
        this.record.state = 'ok'; this.record.message = result.message; this.record.pane = result.pane || req.pane;
      } catch (error) { this.record.state = 'error'; this.record.message = error.message; }
      this.screens.delete(req.pane); this.transcripts.delete(req.pane);
      await this.save();
    }
    return this.snapshot(req);
  }
  async act(req) {
    if (this.mode !== 'interactive') throw Error('The companion is in read-only mode');
    const proof = this.proofs.get(req.proof);
    if (!proof || proof.pane !== req.pane || this.clock() - proof.at > 45000) throw Error('This view is stale. Wait for an update, review it, and send again.');
    const agent = req.op === 'new' && this.herdr.pane ? await this.herdr.pane(req.pane) : await this.herdr.get(req.pane);
    if (identity(agent) !== proof.identity || agent.terminal_id !== req.terminal) throw Error('The agent session changed. Review the new session before sending.');
    if (['key', 'answer'].includes(req.op)) {
      if (agent.agent_status !== 'blocked') throw Error('The agent is no longer waiting for an answer');
      const screen = await this.herdr.read(req.pane);
      if (visibleHash(screen) !== proof.screen || agent.state_change_seq !== proof.seq) throw Error('The question changed. Review the current question before answering.');
      // Consume even when the downstream write is uncertain.
      this.proofs.delete(req.proof);
      if (req.op === 'key') {
        if (!KEYS.has(req.text)) throw Error('Unsupported question key');
        await this.herdr.key(req.pane, req.text);
        return { message: req.text === 'enter' ? 'Enter delivered to the reviewed question.' : 'Question control delivered.' };
      }
      this.validateText(req.text);
      await this.herdr.answer(req.pane, req.text);
      return { message: 'Answer pasted. Review the question, then press Confirm / Enter.' };
    }
    if (req.op === 'stop') {
      if (agent.agent_status !== 'working') throw Error('The agent is not working');
      this.proofs.delete(req.proof); await this.herdr.key(req.pane, 'esc');
      return { message: 'Stop requested. Check the agent status.' };
    }
    this.validateText(req.text);
    if (req.op === 'message') {
      if (agent.agent_status === 'blocked') throw Error('Answer the current question before sending a new task');
      if (!['working', 'idle', 'done'].includes(agent.agent_status)) throw Error('Agent state is unknown; inspect it in Roamgate');
      this.proofs.delete(req.proof); await this.herdr.prompt(req.pane, req.text);
      return { message: 'Message submitted to the agent.' };
    }
    if (req.op === 'new') {
      if (!['codex', 'claude', 'hermes', 'opencode'].includes(req.extra)) throw Error('Choose a supported agent');
      const cwd = agent.foreground_cwd || agent.cwd;
      if (!cwd || cwd === process.env.HOME || !cwd.startsWith('/')) throw Error('Select a session inside a project folder before starting a new chat');
      this.proofs.delete(req.proof);
      const pane = await this.herdr.newChat(agent, req.text, req.extra);
      return { pane, message: `Started ${req.extra} in ${pane}.` };
    }
    throw Error('Unsupported action');
  }
  validateText(text) {
    if (!text.trim() || Buffer.byteLength(text) > 6000 || /[\x00-\x08\x0b-\x1f\x7f]/.test(text)) throw Error('Use 1–6000 UTF-8 bytes of plain text');
  }
  async snapshot(req) {
    const [activeAgents, workspaces, panes, tabs] = await Promise.all([this.herdr.agents(), this.herdr.workspaces(), this.herdr.panes ? this.herdr.panes() : [], this.herdr.tabs ? this.herdr.tabs() : []]);
    const activeMap = new Map(activeAgents.map(a => [a.pane_id, a]));
    const agents = panes.length ? panes.map(p => ({ ...p, ...activeMap.get(p.pane_id) })) : activeAgents;
    const tabNames = new Map(tabs.map(t => [t.tab_id, t.label]));
    const names = new Map(workspaces.map(w => [w.workspace_id, w.label]));
    const list = agents.map(a => ({ pane: a.pane_id, terminal: a.terminal_id, kind: a.agent || 'terminal', activeAgent: !!a.agent, status: a.agent_status, workspaceId: a.workspace_id, workspace: names.get(a.workspace_id) || a.workspace_id, tab: tabNames.get(a.tab_id) || '', title: (a.agent ? (a.terminal_title_stripped || a.terminal_title || a.pane_id) : (tabNames.get(a.tab_id) || a.terminal_title || a.pane_id)).replace(/^[⠁-⣿]\s*/, ''), cwd: a.foreground_cwd || a.cwd }));
    const data = { timestamp: Math.floor(this.clock() / 1000), mode: this.mode, agents: list, workspaces: workspaces.map(w => ({id:w.workspace_id,name:w.label,count:w.pane_count})), ack: this.record, slots: this.slots };
    const selected = agents.find(a => a.pane_id === req.pane);
    if (!selected || !req.visible) return data;
    const selectedIdentity = identity(selected);
    let captured = this.screens.get(req.pane);
    const screenTTL = selected.agent_status === 'working' ? 5000 : 12000;
    if (!captured || captured.identity !== selectedIdentity || captured.seq !== selected.state_change_seq || this.clock() - captured.at >= screenTTL) {
      const text = selected.agent ? await this.herdr.read(req.pane) : await this.herdr.readPane(req.pane);
      captured = {identity:selectedIdentity,seq:selected.state_change_seq,at:this.clock(),text};this.screens.set(req.pane,captured);
    }
    const screen = captured.text;
    // Slow history resolution must never hold up capture or delivery receipts.
    const wantsHistory = req.op === 'view' && (!req.text || req.text === 'conversation');
    let cached = this.historyCache.get(req.pane);
    if (cached?.identity !== selectedIdentity) cached = null;
    if (wantsHistory && (!cached || this.clock() - cached.at >= 15000) && this.historyPending.get(req.pane) !== selectedIdentity) {
      this.historyPending.set(req.pane, selectedIdentity);
      this.roamgate.history(req.pane)
        .then(value => { if (this.historyPending.get(req.pane) === selectedIdentity) this.historyCache.set(req.pane, {at:this.clock(), identity:selectedIdentity, value}); })
        .catch(() => { if (this.historyPending.get(req.pane) === selectedIdentity) this.historyCache.set(req.pane, {at:this.clock(), identity:selectedIdentity, value:{}, error:true}); })
        .finally(() => { if (this.historyPending.get(req.pane) === selectedIdentity) this.historyPending.delete(req.pane); });
    }
    const history = cached?.value || {};
    const entries = (history.entries || history.messages || []).filter(e => e.role === 'user' || e.role === 'assistant').slice(-60).map(e => ({ role:e.role, text:String(e.text || '').slice(0,16000), time:e.sent_at || '' }));
    const historyStatus = entries.length ? 'Roamgate conversation' : !cached ? 'Loading conversation history; showing recent terminal text.' : cached.error ? 'Conversation history unavailable; showing recent terminal text.' : 'This session has no linked conversation history; showing recent terminal text.';
    let transcript = this.transcripts.get(req.pane);
    if (transcript?.identity !== selectedIdentity) transcript = null;
    if (selected.agent_status === 'working') transcript = {identity:selectedIdentity,at:this.clock(),text:screen};
    else if (wantsHistory && !entries.length && (!transcript || this.clock() - transcript.at >= 15000)) {
      let text = screen;
      // Herdr may refuse alternate-screen history (including a transition back
      // to working). Its optional scrollback must not suppress an action receipt.
      try { if (selected.agent) text = await this.herdr.read(req.pane, false); } catch {}
      transcript = {identity:selectedIdentity,at:this.clock(),text}; this.transcripts.set(req.pane,transcript);
    }
    const proofKey = hash(identity(selected) + ':' + selected.state_change_seq + ':' + visibleHash(screen));
    const proof = { pane: req.pane, identity: identity(selected), screen: visibleHash(screen), seq: selected.state_change_seq, at: captured.at };
    this.proofs.set(proofKey, proof);
    for (const [key, value] of this.proofs) if (this.clock() - value.at > 45000) this.proofs.delete(key);
    data.selected = { ...list.find(a => a.pane === req.pane), proof: proofKey, screen, transcript:transcript?.text || screen, entries, historyStatus, updatedAt:data.timestamp };
    if (req.op === 'view' && (['files', 'file', 'changes'].includes(req.text) || req.text?.startsWith('diff:'))) {
      const key = JSON.stringify([selected.workspace_id, req.text, req.extra]);
      const cached = this.browserCache.get(key);
      if ((!cached || this.clock() - cached.at > 10000) && !this.browserPending.has(key)) {
        this.browserPending.add(key);
        this.roamgate.browse(selected.workspace_id, req.text, req.extra)
          .then(value => this.browserCache.set(key, { at: this.clock(), value }))
          .catch(error => this.browserCache.set(key, { at: this.clock(), value: { view: req.text, path: req.extra, entries: [], text: '', error: error.message } }))
          .finally(() => { this.browserPending.delete(key); if (this.browserCache.size > 50) this.browserCache.delete(this.browserCache.keys().next().value); });
      }
      data.browser = cached?.value || { view: req.text, path: req.extra, entries: [], text: '', loading: true };
    }
    return data;
  }
}
