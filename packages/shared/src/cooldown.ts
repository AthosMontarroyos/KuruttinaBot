/**
 * Simple in-memory cooldown manager per user/guild.
 */
export class CooldownManager {
  private cooldowns: Map<string, number> = new Map();
  private cooldownSeconds: number;

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
    this.cooldowns.set(key, now + this.cooldownSeconds * 1000);
  }
}
