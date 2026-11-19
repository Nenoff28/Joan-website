/** Whether the store is open at `now` (a Date already in Sofia wall-clock time) and which hours row is today's.
 * `hours` rows are [label, "HH:MM – HH:MM"]: 0 = Monday–Friday, 1 = Saturday, 2 = Sunday. */
export function storeStatus(hours: readonly (readonly string[])[], now: Date) {
  const day = now.getDay();
  const today = day === 0 ? 2 : day === 6 ? 1 : 0;
  const match = hours[today]?.[1]?.match(/(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = match ? minutes >= Number(match[1]) * 60 + Number(match[2]) && minutes < Number(match[3]) * 60 + Number(match[4]) : false;
  return { open, today };
}
