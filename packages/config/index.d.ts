export type AppEnv = 'development' | 'production';
export function loadAppConfig(env?: Record<string, string | undefined>): Readonly<{ appEnv: AppEnv }>;
export function loadLocalWebConfig(env?: Record<string, string | undefined>): Readonly<{
  appEnv: AppEnv;
  host: 'localhost';
  port: number;
  origin: string;
}>;
