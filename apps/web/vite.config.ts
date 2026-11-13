import { foldkit } from '@foldkit/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const authToken = process.env.SENTRY_AUTH_TOKEN
const org = process.env.SENTRY_ORG
const project = process.env.SENTRY_PROJECT
const release = process.env.VITE_SENTRY_RELEASE
const uploads = authToken !== undefined && org !== undefined && project !== undefined

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
}

/**
 * In dev, `/data/*` comes from the folder `irodori lesson` writes. In production the Worker
 * serves the same paths from R2 (`src/worker.ts`).
 */
const lessonData = (): Plugin => {
  const root = fileURLToPath(new URL('../../packages/irodori/data', import.meta.url))
  return {
    name: 'lesson-data',
    configureServer(server) {
      server.middlewares.use('/data', (request, response, next) => {
        const path = normalize(
          join(root, decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')),
        )
        if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) return next()
        response.setHeader('content-type', MIME[extname(path)] ?? 'application/octet-stream')
        response.setHeader('accept-ranges', 'bytes')
        createReadStream(path).pipe(response)
      })
    },
  }
}

export default defineConfig({
  // Source maps go to Sentry only from a build with the upload credentials, and
  // never into the deployed assets: hidden maps carry no link in the bundle.
  build: { sourcemap: uploads ? 'hidden' : false },
  plugins: [
    tailwindcss(),
    foldkit(),
    lessonData(),
    // Last, so it sees the final bundle.
    uploads
      ? sentryVitePlugin({
          authToken,
          org,
          project,
          ...(release ? { release: { name: release } } : {}),
          sourcemaps: {
            assets: ['./dist/**'],
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        })
      : null,
  ],
  resolve: {
    dedupe: ['effect', 'foldkit'],
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
