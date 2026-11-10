// Codex can keep working while a user-input request waits in its follow-up tray.
// That tray is not an answer field. Only the displayed shortcut opens it; Enter
// must never be used to open or automatically answer it.
export function questionMode(agent, screen) {
  const footer=screen.slice(-2400);
  if (agent.agent==='codex' && /Queued follow-up inputs/.test(footer) && /shift\+(?:←|left)\s+to answer/i.test(footer)) return 'queued';
  return agent.agent_status==='blocked' ? 'visible' : 'none';
}
