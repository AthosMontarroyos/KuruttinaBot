import { config as loadEnv } from 'dotenv';
import { readSiteConfig } from './config.js';
import { createSiteServer } from './http.js';

loadEnv();
const config = readSiteConfig(process.env);
const publicDirectory = new URL('./public/', import.meta.url);
const server = await createSiteServer(config, new URL('index.html', publicDirectory), publicDirectory);
server.listen(config.port, config.host, () => console.log(`Home local: http://${config.host}:${config.port}`));
server.on('error', () => { console.error('Não foi possível iniciar o site. Verifique se a porta está disponível.'); process.exitCode = 1; });
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 5_000).unref();
  });
}
