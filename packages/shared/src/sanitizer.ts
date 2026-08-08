import { z } from 'zod';

/**
 * Validador de Nome de Comando Slash de acordo com as regras rígidas da API do Discord.
 */
export const commandNameSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9_-]+$/, {
    message: 'Nome do comando deve conter apenas letras minúsculas, números, hífens e underlines.',
  });

/**
 * Sanitiza entradas de texto de usuários/comandos para prevenir injeções de script ou caracteres de controle perigosos.
 */
export function sanitizeText(input: string, maxLength = 2000): string {
  if (!input) return '';

  return input
    // Remove caracteres de controle nulos e invisíveis perigosos
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Previne injeção de marcadores de formato corrompidos
    .trim()
    .slice(0, maxLength);
}

/**
 * Validador de Payload de Comandos Personalizados / Afiliados do Supabase.
 * Garante que comandos customizados sejam PURAMENTE DECLARATIVOS (Estrutura de Dados JSON).
 */
export const customCommandPayloadSchema = z.object({
  name: commandNameSchema,
  description: z.string().min(1).max(100),
  responseType: z.enum(['text', 'embed', 'modal']),
  content: z.string().max(2000).optional(),
  embedData: z
    .object({
      title: z.string().max(256).optional(),
      description: z.string().max(4000).optional(),
      color: z.number().optional(),
      fields: z
        .array(
          z.object({
            name: z.string().max(256),
            value: z.string().max(1024),
            inline: z.boolean().optional(),
          })
        )
        .max(25)
        .optional(),
    })
    .optional(),
});

export type CustomCommandPayload = z.infer<typeof customCommandPayloadSchema>;
