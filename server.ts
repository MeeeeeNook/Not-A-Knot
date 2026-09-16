import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Client IP detection endpoint
  app.get('/api/client-ip', (req, res) => {
    const forwarded = req.headers['x-forwarded-for'];
    let ip = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : Array.isArray(forwarded)
      ? forwarded[0]
      : (req.headers['x-real-ip'] as string) || req.socket.remoteAddress || '';
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    res.json({
      ip: ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });
  });

  // Vite middleware for development / Static file serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : path.join(process.cwd(), 'build');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
