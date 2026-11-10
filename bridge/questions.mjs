// Codex can keep working while a user-input request waits in its follow-up tray.
// That tray is not an answer field. Only the displayed shortcut opens it; Enter
// must never be used to open or automatically answer it.
export function followupQuestion(agent, screen) {
  if (agent.agent!=='codex') return null;
  // This is Codex's user-input tray, not a tool-permission dialog. Retain every
  // question/choice/draft byte, excluding only the independently updating work
  // transcript above it. Unknown or incomplete layouts keep the full-screen guard.
  const header=[...screen.matchAll(/^\s*[•●]?\s*Queued follow-up inputs\s*$/gm)].at(-1);
  if (!header) return null;
  const tray=screen.slice(header.index);
  const footer=/^\s*enter submit\s+\^\] skip\s+shift\+(?:→|right) main prompt\s+shift\+(?:←|left) next question\s*$/m.exec(tray);
  return footer ? tray.slice(0,footer.index+footer[0].length).trim() : null;
}
export function questionMode(agent, screen) {
  if (followupQuestion(agent,screen)) return 'visible';
  const footer=screen.slice(-2400);
  if (agent.agent==='codex' && /Queued follow-up inputs/.test(footer) && /shift\+(?:←|left)\s+to answer/i.test(footer)) return 'queued';
  return agent.agent_status==='blocked' ? 'visible' : 'none';
}
