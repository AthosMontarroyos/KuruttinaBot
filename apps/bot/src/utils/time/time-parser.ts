/**
 * Result of parsing a time duration input string.
 */
export interface ParsedTimeResult {
  seconds: number;
  milliseconds: number;
  minutes: number;
  hours: number;
  days: number;
  formatted: string;
  humanReadable: string;
}

export interface ParseTimeOptions {
  /**
   * Minimum allowed duration in seconds.
   */
  minSeconds?: number;
  /**
   * Maximum allowed duration in seconds.
   */
  maxSeconds?: number;
  /**
   * Default unit to assume if only a raw number is passed (e.g. '28' -> 's', 'm', 'h', 'd').
   * @default 's'
   */
  defaultUnit?: 's' | 'm' | 'h' | 'd';
}

/**
 * Parses time duration strings into structured time values.
 * Supports units:
 * - `s` / `seg` / `segundos` (Seconds)
 * - `m` / `min` / `minutos` (Minutes)
 * - `h` / `hrs` / `horas` (Hours)
 * - `d` / `dias` (Days)
 * 
 * Accepts combined formats like: `28d`, `12h`, `30m`, `45s`, `1d12h30m`.
 */
export function parseTimeString(
  input?: string | number | null,
  options: ParseTimeOptions = {}
): ParsedTimeResult | null {
  if (input === undefined || input === null) return null;

  let totalSeconds = 0;
  const strInput = String(input).trim().toLowerCase();

  if (!strInput) return null;

  // Handle pure numbers (e.g., "28" or 28)
  if (/^\d+$/.test(strInput)) {
    const rawValue = parseInt(strInput, 10);
    const unit = options.defaultUnit ?? 's';
    switch (unit) {
      case 'd':
        totalSeconds = rawValue * 86400;
        break;
      case 'h':
        totalSeconds = rawValue * 3600;
        break;
      case 'm':
        totalSeconds = rawValue * 60;
        break;
      case 's':
      default:
        totalSeconds = rawValue;
        break;
    }
  } else {
    // Regex matching patterns like 28d, 12h, 30m, 45s, 28dias, 28horas, 28minutos, 28segundos
    const regex = /(\d+)\s*(d|dias?|h|hrs?|horas?|m|min|minutos?|s|seg|segundos?)/gi;
    let match: RegExpExecArray | null;
    let foundMatches = false;

    while ((match = regex.exec(strInput)) !== null) {
      foundMatches = true;
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      if (unit.startsWith('d')) {
        totalSeconds += value * 86400;
      } else if (unit.startsWith('h')) {
        totalSeconds += value * 3600;
      } else if (unit.startsWith('m')) {
        totalSeconds += value * 60;
      } else if (unit.startsWith('s')) {
        totalSeconds += value;
      }
    }

    if (!foundMatches) return null;
  }

  // Validate limits if provided
  if (options.minSeconds !== undefined && totalSeconds < options.minSeconds) {
    return null;
  }
  if (options.maxSeconds !== undefined && totalSeconds > options.maxSeconds) {
    return null;
  }

  return buildParsedTimeResult(totalSeconds);
}

/**
 * Constructs a ParsedTimeResult from total seconds.
 */
export function buildParsedTimeResult(totalSeconds: number): ParsedTimeResult {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedParts: string[] = [];
  const humanParts: string[] = [];

  if (days > 0) {
    formattedParts.push(`${days}d`);
    humanParts.push(`${days} ${days === 1 ? 'Dia' : 'Dias'}`);
  }
  if (hours > 0) {
    formattedParts.push(`${hours}h`);
    humanParts.push(`${hours} ${hours === 1 ? 'Hora' : 'Horas'}`);
  }
  if (minutes > 0) {
    formattedParts.push(`${minutes}m`);
    humanParts.push(`${minutes} ${minutes === 1 ? 'Minuto' : 'Minutos'}`);
  }
  if (seconds > 0 || formattedParts.length === 0) {
    formattedParts.push(`${seconds}s`);
    humanParts.push(`${seconds} ${seconds === 1 ? 'Segundo' : 'Segundos'}`);
  }

  let humanReadable = humanParts.join(', ');
  if (humanParts.length > 1) {
    const lastComma = humanReadable.lastIndexOf(', ');
    humanReadable =
      humanReadable.substring(0, lastComma) +
      ' e ' +
      humanReadable.substring(lastComma + 2);
  }

  return {
    seconds: totalSeconds,
    milliseconds: totalSeconds * 1000,
    minutes: Math.floor(totalSeconds / 60),
    hours: Math.floor(totalSeconds / 3600),
    days: Math.floor(totalSeconds / 86400),
    formatted: formattedParts.join(' '),
    humanReadable,
  };
}

/**
 * Formats seconds into concise readable duration string (e.g. "28d", "12h 30m").
 */
export function formatDuration(seconds: number): string {
  return buildParsedTimeResult(seconds).formatted;
}

/**
 * Formats seconds into human-readable Portuguese duration string (e.g. "28 Dias", "1 Hora e 30 Minutos").
 */
export function formatDurationHuman(seconds: number): string {
  return buildParsedTimeResult(seconds).humanReadable;
}
