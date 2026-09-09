export interface ParsedPlayer {
  firstName: string;
  lastNameInitial: string;
  jerseyNumber: string;
}

/**
 * Parses one player per line, tolerant of a few common shapes:
 *   "Ava"
 *   "Ava T"
 *   "Ava T 7"
 *   "Ava T #7"
 *   "Ava #7"
 */
export function parseBulkPlayers(text: string): ParsedPlayer[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tokens = line.split(/\s+/);
      let jerseyNumber = "";
      const last = tokens[tokens.length - 1];
      if (last && /^#?\d{1,3}$/.test(last)) {
        jerseyNumber = last.replace("#", "");
        tokens.pop();
      }
      let lastNameInitial = "";
      const newLast = tokens[tokens.length - 1];
      if (tokens.length > 1 && newLast && /^[A-Za-z]\.?$/.test(newLast)) {
        lastNameInitial = newLast.replace(".", "").toUpperCase();
        tokens.pop();
      }
      const firstName = tokens.join(" ");
      return { firstName, lastNameInitial, jerseyNumber };
    })
    .filter((p) => p.firstName.length > 0);
}
