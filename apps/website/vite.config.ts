import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Vite configuration with custom middleware to serve root Pictures/ assets
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-pictures-assets',
      configureServer(server) {
        server.middlewares.use('/assets/emojis', (req, res, next) => {
          const filename = req.url?.replace(/^\//, '') || '';
          const filePath = path.resolve(__dirname, '../../Pictures/emojis', filename);

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType =
              ext === '.gif'
                ? 'image/gif'
                : ext === '.png'
                ? 'image/png'
                : ext === '.webp'
                ? 'image/webp'
                : ext === '.json'
                ? 'application/json'
                : 'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            return fs.createReadStream(filePath).pipe(res);
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@kuruttina/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
