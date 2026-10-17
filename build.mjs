import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/main.js', 'src/debug/textures.js'],
  bundle: true,
  format: 'iife',
  outdir: 'dist',
  outbase: 'src',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  target: ['chrome100', 'safari15', 'firefox100'],
  legalComments: 'none',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[build] watching...');
} else {
  const t0 = Date.now();
  await esbuild.build(options);
  const fs = await import('node:fs');
  const kb = fs.statSync('dist/main.js').size / 1024;
  console.log(`[build] dist/main.js  ${kb.toFixed(1)} kB  in ${Date.now() - t0}ms`);
}
