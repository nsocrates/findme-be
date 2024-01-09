import * as esbuild from 'esbuild'
import path from 'node:path'
import fs from 'node:fs/promises'

async function main() {
  const inDir = path.resolve(__dirname, 'lambdas')
  const outDir = path.resolve(__dirname, '.out')
  const files = await fs.readdir(inDir, { withFileTypes: true })
  const promises: Promise<string>[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    if (file.isFile()) {
      const filePath = path.resolve(inDir, file.name)
      const outFile = path.resolve(outDir, file.name.replace(/\.ts$/, '.js'))
      const params: esbuild.BuildOptions = {
        entryPoints: [filePath],
        bundle: true,
        minify: true,
        format: 'cjs',
        target: 'node18',
        platform: 'node',
        outfile: outFile,
        logLevel: 'info',
      }

      const ret = () => outFile
      const promise = esbuild.build(params).then(ret)
      promises.push(promise)
    }
  }

  return Promise.all(promises)
}

export default main
