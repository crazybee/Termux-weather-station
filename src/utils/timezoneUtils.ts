/**
 * Timezone & Local <-> UTC Time Conversion Utilities
 * Used for aligning local solar forecast windows with Easee Cloud UTC APIs.
 */

/**
 * Extracts { hours, minutes } from various time representations:
 * - Full ISO-8601 string: "2026-08-25T22:00:00Z", "2026-08-25T22:00:00+02:00"
 * - ISO time portion: "T22:00:00", "T22:00:00Z"
 * - 24-hour time: "22:00", "22:00:00", "00:00"
 * - 12-hour time: "10:30 PM", "6:00 AM"
 */
function extractHoursAndMinutes(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();

  // 1. Check for ISO 8601 timestamp with 'T' (e.g. "2026-08-25T22:00:00Z")
  const isoMatch = trimmed.match(/T(\d{1,2}):(\d{2})/i);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1], 10);
    const minutes = parseInt(isoMatch[2], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return { hours: hours % 24, minutes: minutes % 60 };
    }
  }

  // 2. Check for 12-hour format with AM/PM (e.g. "10:30 PM", "6:00 AM")
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][mM])$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const modifier = ampmMatch[3].toUpperCase();
    if (modifier === "PM" && hours < 12) hours += 12;
    else if (modifier === "AM" && hours === 12) hours = 0;
    return { hours: hours % 24, minutes: minutes % 60 };
  }

  // 3. Check for standard 24-hour format (e.g. "22:00", "00:00", "06:00:00")
  const standardMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (standardMatch) {
    const hours = parseInt(standardMatch[1], 10);
    const minutes = parseInt(standardMatch[2], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return { hours: hours % 24, minutes: minutes % 60 };
    }
  }

  return null;
}

/**
 * Converts a Local Time string ("HH:MM" or "HH:MM:SS" or ISO) to UTC ("HH:MM") using the location's UTC offset in minutes.
 * Example: Local "00:00" in UTC+2 (120 mins) -> UTC "22:00"
 */
export function convertLocalToUtc(localTimeStr: string, utcOffsetMinutes: number = 0): string {
  if (!localTimeStr) return "10:30";

  const extracted = extractHoursAndMinutes(localTimeStr);
  if (!extracted) return "10:30";

  const totalLocalMinutes = extracted.hours * 60 + extracted.minutes;
  // Subtract offset to get UTC
  const totalUtcMinutes = (totalLocalMinutes - utcOffsetMinutes + 24 * 60 * 2) % (24 * 60);

  const utcHours = Math.floor(totalUtcMinutes / 60);
  const utcMins = totalUtcMinutes % 60;

  return `${String(utcHours).padStart(2, "0")}:${String(utcMins).padStart(2, "0")}`;
}

/**
 * Converts a UTC Time string ("HH:MM" or "HH:MM:SS" or ISO timestamp) to Local Time ("HH:MM") using the location's UTC offset in minutes.
 * Example: UTC "22:00" (or "2026-08-25T22:00:00Z") in UTC+2 (120 mins) -> Local "00:00"
 */
export function convertUtcToLocal(utcTimeStr: string, utcOffsetMinutes: number = 0): string {
  if (!utcTimeStr) return "10:30";

  const extracted = extractHoursAndMinutes(utcTimeStr);
  if (!extracted) return "10:30";

  const totalUtcMinutes = extracted.hours * 60 + extracted.minutes;
  // Add offset to get Local
  const totalLocalMinutes = (totalUtcMinutes + utcOffsetMinutes + 24 * 60 * 2) % (24 * 60);

  const localHours = Math.floor(totalLocalMinutes / 60);
  const localMins = totalLocalMinutes % 60;

  return `${String(localHours).padStart(2, "0")}:${String(localMins).padStart(2, "0")}`;
}

/**
 * Formats UTC offset in minutes to human-readable string like "UTC+2", "UTC-5", "UTC+5:30".
 */
export function formatUtcOffset(utcOffsetMinutes: number = 0): string {
  const sign = utcOffsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(utcOffsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const remainingMins = absMinutes % 60;

  if (remainingMins === 0) {
    return `UTC${sign}${hours}`;
  }
  return `UTC${sign}${hours}:${String(remainingMins).padStart(2, "0")}`;
}

/**
 * Resolves current UTC offset in minutes from a timezone name (e.g. "Europe/Berlin", "America/New_York").
 */
export function getTimezoneOffsetMinutes(timezoneName?: string): number {
  if (!timezoneName) {
    return -new Date().getTimezoneOffset();
  }
  try {
    const now = new Date();
    const str = now.toLocaleString("en-US", { timeZone: timezoneName, timeZoneName: "shortOffset" });
    const match = str.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const mins = match[2] ? parseInt(match[2], 10) : 0;
      return hours * 60 + (hours >= 0 ? mins : -mins);
    }
  } catch {}
  return -new Date().getTimezoneOffset();
}

/**
 * Parses any 12-hour (e.g. "12:30 PM", "6:30 PM", "10:30 AM") or 24-hour time string into a 24-hour "HH:MM" format.
 */
export function parseTimeTo24H(timeStr?: string, defaultTime: string = "10:30"): string {
  if (!timeStr) return defaultTime;
  const extracted = extractHoursAndMinutes(timeStr);
  if (!extracted) return defaultTime;
  return `${String(extracted.hours).padStart(2, "0")}:${String(extracted.minutes).padStart(2, "0")}`;
}

/**
 * Formats a 24-hour "HH:MM" string to a 12-hour format (e.g. "18:30" -> "6:30 PM").
 */
export function format24HTo12H(time24: string): string {
  if (!time24) return "";
  const extracted = extractHoursAndMinutes(time24);
  if (!extracted) return time24;
  const hour = extracted.hours;
  const min = String(extracted.minutes).padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${min} ${period}`;
}
