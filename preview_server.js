const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);

  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  const serveFile = (target) => {
    response.writeHead(200, {
      'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0',
    });
    fs.createReadStream(target).pipe(response);
  };

  fs.stat(file, (statError, stats) => {
    if (statError) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    if (stats.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(308, { Location: `${pathname}/${requestUrl.search}` }).end();
        return;
      }
      const directoryIndex = path.join(file, 'index.html');
      fs.stat(directoryIndex, (indexError, indexStats) => {
        if (indexError || !indexStats.isFile()) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
          return;
        }
        serveFile(directoryIndex);
      });
      return;
    }

    if (!stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    serveFile(file);
  });
}).listen(port, host, () => {
  console.log(`Jamie Portfolio: http://${host}:${port}/`);
});
