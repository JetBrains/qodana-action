import {afterEach, beforeEach, expect, test} from '@jest/globals'
import * as fs from 'fs'
import * as os from 'os'
import path from 'path'
import {prepareCaches, uploadCache} from '../src/utils'

let root: string
let projectCache: string
let cacheDir: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'qodana-caches-'))
  projectCache = path.join(root, 'project', '.qodana', 'cache')
  cacheDir = path.join(root, 'builds', '.qodana', 'cache')
  process.env.QODANA_CACHE_DIR = projectCache
})

afterEach(() => {
  delete process.env.QODANA_CACHE_DIR
  fs.rmSync(root, {recursive: true, force: true})
})

function writeFile(dir: string, name: string, content: string): void {
  fs.mkdirSync(dir, {recursive: true})
  fs.writeFileSync(path.join(dir, name), content)
}

test('prepareCaches moves the project cache out of the project', () => {
  writeFile(projectCache, 'index', 'restored')
  fs.mkdirSync(cacheDir, {recursive: true})

  prepareCaches(cacheDir)

  expect(fs.existsSync(projectCache)).toBe(false)
  expect(fs.readFileSync(path.join(cacheDir, 'index'), 'utf8')).toBe('restored')
})

test('prepareCaches replaces a stale cacheDir', () => {
  writeFile(projectCache, 'index', 'restored')
  writeFile(cacheDir, 'stale', 'stale')

  prepareCaches(cacheDir)

  expect(fs.existsSync(path.join(cacheDir, 'stale'))).toBe(false)
  expect(fs.existsSync(path.join(cacheDir, 'index'))).toBe(true)
})

test('uploadCache moves the cache back and drops removed files', () => {
  writeFile(projectCache, 'removed', 'old')
  prepareCaches(cacheDir)
  fs.rmSync(path.join(cacheDir, 'removed'))
  writeFile(cacheDir, 'index', 'updated')

  uploadCache(cacheDir, true)

  expect(fs.existsSync(cacheDir)).toBe(false)
  expect(fs.existsSync(path.join(projectCache, 'removed'))).toBe(false)
  expect(fs.readFileSync(path.join(projectCache, 'index'), 'utf8')).toBe(
    'updated'
  )
})

test('uploadCache twice keeps the cache in the project', () => {
  writeFile(cacheDir, 'index', 'updated')

  uploadCache(cacheDir, true)
  uploadCache(cacheDir, true)

  expect(fs.readFileSync(path.join(projectCache, 'index'), 'utf8')).toBe(
    'updated'
  )
})

test('uploadCache does nothing without useCaches', () => {
  writeFile(projectCache, 'index', 'restored')
  writeFile(cacheDir, 'index', 'updated')

  uploadCache(cacheDir, false)

  expect(fs.readFileSync(path.join(projectCache, 'index'), 'utf8')).toBe(
    'restored'
  )
})

test('the same location for both is left in place', () => {
  writeFile(projectCache, 'index', 'restored')

  prepareCaches(projectCache)
  uploadCache(projectCache, true)

  expect(fs.readFileSync(path.join(projectCache, 'index'), 'utf8')).toBe(
    'restored'
  )
})
