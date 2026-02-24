import { createServer, type Server } from 'node:http';

let server: Server | null = null;

export const startHealthServer = (port: number): void => {
  server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`  Health endpoint listening on port ${port}`);
  });
};

export const stopHealthServer = (): Promise<void> => {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    server.close(() => {
      server = null;
      resolve();
    });
  });
};
