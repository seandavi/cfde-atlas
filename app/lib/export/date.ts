export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toIsoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
