const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", or "Nov 19" (adds the year when it isn't this year). */
export function formatRelativeDate(iso: string, now = new Date()) {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatDateTime(iso: string) {
  const date = new Date(iso);
  return `${formatRelativeDate(iso)}, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
