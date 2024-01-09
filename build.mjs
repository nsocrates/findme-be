import * as esbuild from 'esbuild'
import path from 'node:path'
import url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

;(function main() {
  const indir = path.resolve(__dirname, 'lambdas')
  const outdir = path.resolve(__dirname, '.out')
  const params = {
    outdir,
    entryPoints: [path.resolve(indir, '*')],
    bundle: true,
    minify: true,
    format: 'cjs',
    target: 'node18',
    platform: 'node',
    logLevel: 'info',
  }

  return esbuild.build(params).catch(console.error)
})()
