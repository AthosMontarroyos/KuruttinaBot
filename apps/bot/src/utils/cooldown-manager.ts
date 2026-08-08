/**
 * Gerenciador de Cooldown / Rate Limit de Comandos em Memória (Zero Memory Leak).
 */
export class CooldownManager {
  private static cooldowns = new Map<string, Map<string, number>>();

  /**
   * Verifica se o usuário está em cooldown para determinado comando.
   * @param commandName Nome do comando
   * @param userId ID do usuário no Discord
   * @param cooldownSeconds Duração do cooldown em segundos (Padrão: 3s)
   * @returns Tempo restante em segundos (0 se não estiver em cooldown)
   */
  public static checkCooldown(
    commandName: string,
    userId: string,
    cooldownSeconds = 3
  ): number {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map<string, number>());
    }

    const timestamps = this.cooldowns.get(commandName)!;
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
