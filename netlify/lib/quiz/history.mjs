// history.json keeps one aggregated entry per session, ordered by date.
export function upsertHistory(doc, entry) {
  const sessions = (doc?.sessions ?? []).filter((e) => e.session !== entry.session);
  sessions.push(entry);
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session));
  return { sessions };
}
