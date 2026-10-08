const path = require('node:path');
const { buildSync } = require('esbuild');
function buildClient() {
  buildSync({
    entryPoints: [path.join(__dirname, '..', 'public', 'app.js')],
    outfile: path.join(__dirname, '..', 'public', 'build', 'app.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    jsx: 'automatic',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'eof',
  });
}
if (require.main === module) buildClient();
module.exports = { buildClient };
