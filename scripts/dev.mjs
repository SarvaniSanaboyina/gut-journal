import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const children = []
let shuttingDown = false

function start(file, args) {
  const child = spawn(process.execPath, [file, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  children.push(child)
  child.on('exit', (code) => {
    if (shuttingDown) return
    shutdown(code ?? 0)
  })
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 150)
}

start(join(root, 'node_modules/tsx/dist/cli.mjs'), ['server/index.ts'])
start(join(root, 'node_modules/vite/bin/vite.js'), [])

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
