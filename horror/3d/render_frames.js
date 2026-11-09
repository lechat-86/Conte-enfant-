// node render_frames.js <outdir> <startFrame> <endFrame> <step> <anchorsJSON> [w] [h] [fps]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [outdir, s0, s1, step, anchors, w = '1920', h = '1080', fps = '24'] = process.argv.slice(2);
const root = path.join(__dirname, 'www');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
});
(async () => {
  await new Promise(res => srv.listen(0, res));
  const port = srv.address().port;
  fs.mkdirSync(outdir, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto(`http://localhost:${port}/scene.html?w=${w}&h=${h}&a=${encodeURIComponent(anchors)}`);
  await p.waitForFunction('window.ready===true', { timeout: 120000 });
  for (let f = +s0; f < +s1; f += +step) {
    const d = await p.evaluate(t => window.renderFrame(t), f / +fps);
    fs.writeFileSync(path.join(outdir, 'f_' + String(f).padStart(5, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64'));
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
