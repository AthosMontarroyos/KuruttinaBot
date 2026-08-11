/**
 * Unified in-memory Cooldown / Rate Limit Manager (Zero Memory Leak).
 * Supports both instance-based rate limiters and static command-keyed rate limiters.
 */
export class CooldownManager {
  private cooldowns: Map<string, number> = new Map();
  private cooldownSeconds: number;

  private static globalCooldowns = new Map<string, Map<string, number>>();

  constructor(cooldownSeconds: number) {
    this.cooldownSeconds = cooldownSeconds;
  }

  /**
   * Returns remaining cooldown in seconds, or 0 if expired/not set.
   */
  public check(key: string): number {
    const now = Date.now();
    const expiresAt = this.cooldowns.get(key);
    if (!expiresAt) return 0;

    const diff = Math.ceil((expiresAt - now) / 1000);
    if (diff <= 0) {
      this.cooldowns.delete(key);
      return 0;
    }
    return diff;
  }

  /**
   * Applies the cooldown to key.
   */
  public apply(key: string): void {
    const now = Date.now();
    const durationMs = this.cooldownSeconds * 1000;
    this.cooldowns.set(key, now + durationMs);

    // Auto-cleanup timer to prevent memory leaks
    setTimeout(() => {
      if (this.cooldowns.get(key) === now + durationMs) {
        this.cooldowns.delete(key);
      }
    }, durationMs);
  }

  /**
   * Static helper: Checks and applies cooldown for a specific command and user.
   * @param commandName Name of the command
   * @param userId Discord User ID
   * @param cooldownSeconds Cooldown duration in seconds (Default: 3s)
   * @returns Remaining cooldown in seconds (0 if allowed)
   */
  public static checkCooldown(
    commandName: string,
    userId: string,
    cooldownSeconds = 3
  ): number {
    if (!this.globalCooldowns.has(commandName)) {
      this.globalCooldowns.set(commandName, new Map<string, number>());
    }

    const timestamps = this.globalCooldowns.get(commandName)!;
    const now = Date.now();
    const cooldownAmount = cooldownSeconds * 1000;

    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId)! + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return Number(timeLeft.toFixed(1));
      }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);
    return 0;
  }
}

