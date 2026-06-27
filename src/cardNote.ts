// One-shot handoff for the post-scan summary: ScanCardScreen stashes a note,
// ChatScreen consumes it once on focus. Avoids route-param/load-effect races.
let pending: string | null = null;

export function setCardNote(note: string): void {
  pending = note;
}

export function takeCardNote(): string | null {
  const n = pending;
  pending = null;
  return n;
}
