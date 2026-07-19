const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = __dirname;
const port = readArg('--port', process.env.PORT || '4173');
const host = readArg('--host', '127.0.0.1');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function readArg(name, fallback) {
  const exact = process.argv.find((arg) => arg === name);
  if (exact) {
    const idx = process.argv.indexOf(exact);
    return process.argv[idx + 1] || fallback;
  }
  const prefixed = process.argv.find((arg) => arg.startsWith(name + '='));
  if (prefixed) return prefixed.slice(name.length + 1);
  return fallback;
}

function resolveFile(requestPath) {
  const decoded = decodeURIComponent(requestPath || '/');
  const cleanPath = decoded.split('?')[0];
  let relative = cleanPath === '/' ? '/index.html' : cleanPath;
  relative = relative.replace(/^\/+/, '');
  let filePath = path.join(root, relative);
  if (!filePath.startsWith(root)) {
    return null;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return filePath;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || host}`);
    const filePath = resolveFile(url.pathname);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      res.end(data);
    });
  })
  .listen(Number(port), host, () => {
    console.log(`Static server running at http://${host}:${port}`);
  });
