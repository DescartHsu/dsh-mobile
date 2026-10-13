import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { inspect } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cpolarWindowsExtractionStep, cpolarWindowsSystemTool, extractWindowsMsiBinary, runCpolarWindowsTool } from '../src/windows-msi-extract.js'

const commands = vi.hoisted(() => ({ run: vi.fn(), stat: vi.fn() }))
vi.mock('../src/exec-file.js', () => ({ execFileText: commands.run }))
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, lstat: commands.stat }
})
const roots: string[] = []
const nativePowerShell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const nativeExpand = 'C:\\Windows\\System32\\expand.exe'
const member = 'cpolar_exe'

async function fixture(): Promise<{ readonly root: string; readonly msi: string }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-mobile-msi-'))
  roots.push(root)
  const msi = join(root, 'fixture.msi')
  await writeFile(msi, 'fixture database')
  return { root, msi }
}

beforeEach(async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  commands.stat.mockReset().mockImplementation(actual.lstat)
  vi.stubGlobal('process', { ...process, platform: 'win32', env: { ...process.env, SystemRoot: 'C:\\Windows' } })
  commands.run.mockReset()
  commands.run.mockImplementation(async (file: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
    if (file === nativePowerShell) {
      const cabinet = options.env?.DSH_MSI_CABINET
      if (cabinet === undefined) throw new Error('fixture cabinet missing')
      await writeFile(cabinet, Buffer.alloc(36))
      return { stdout: JSON.stringify({ Member: member, Bytes: 4, CabinetBytes: 36 }), stderr: '' }
    }
    const destination = args[2]
    if (destination === undefined) throw new Error('fixture destination missing')
    await writeFile(join(destination, member), 'test')
    return { stdout: '', stderr: '' }
  })
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('read-only Windows MSI binary extraction', () => {
  it('uses fixed system tools, bounded reads and exact cabinet members without executing an installer', async () => {
    const { root, msi } = await fixture()
    await extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)
    expect(await readFile(join(root, 'cpolar.exe'), 'utf8')).toBe('test')
    expect(commands.run.mock.calls.map(call => basename(call[0] as string))).toHaveLength(2)
    expect(commands.run).toHaveBeenLastCalledWith(nativeExpand, [join(root, 'component.cab'), `-F:${member}`, join(root, 'cabinet')], {
      windowsHide: true, timeout: 120_000, maxBuffer: 16_384,
    })
    const call = commands.run.mock.calls[0]!
    expect(call[0]).toBe(nativePowerShell)
    expect(call[2]).toMatchObject({ windowsHide: true, timeout: 120_000, maxBuffer: 16_384, env: {
      DSH_MSI_SOURCE: msi, DSH_MSI_CABINET: join(root, 'component.cab'), DSH_MSI_BINARY: 'cpolar.exe', DSH_MSI_BYTES: '4',
    } })
    const source = Buffer.from(call[1][4] as string, 'base64').toString('utf16le')
    expect(source).toContain('MsiOpenDatabaseW(msi, IntPtr.Zero')
    expect(source).toContain('FileMode.CreateNew')
    expect(source).toContain('MsiRecordReadStream')
    expect(source).toContain('MsiCloseHandle')
    expect(source).toContain('DllImportSearchPath.System32')
    expect(source).not.toContain(msi)
    expect(source).not.toMatch(/MsiInstallProduct|MsiDoAction|msiexec|AdminExecuteSequence|InstallExecuteSequence/u)
  })

  it.each(['../outside', 'file/name', 'file\\name', '..', '-option', 'wild*card', 'x?'])('rejects unsafe MSI member %s before expansion', async badMember => {
    const { root, msi } = await fixture()
    commands.run.mockImplementationOnce(async (_file, _args, options) => {
      await writeFile(options.env.DSH_MSI_CABINET, Buffer.alloc(36))
      return { stdout: JSON.stringify({ Member: badMember, Bytes: 4, CabinetBytes: 36 }), stderr: '' }
    })
    await expect(extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)).rejects.toMatchObject({ message: 'cpolar_extract_database_failed', stage: 'database' })
    expect(commands.run).toHaveBeenCalledTimes(1)
    expect(await readdir(root)).not.toContain('cabinet')
  })

  it.each([
    { Member: member, Bytes: 5, CabinetBytes: 36 },
    { Member: member, Bytes: 4, CabinetBytes: 33_554_433 },
    { Member: member, Bytes: 4, CabinetBytes: 35 },
    { Member: member, Bytes: 4, CabinetBytes: 37 },
  ])('rejects invalid MSI or written cabinet size $CabinetBytes', async metadata => {
    const { root, msi } = await fixture()
    commands.run.mockImplementationOnce(async (_file, _args, options) => {
      await writeFile(options.env.DSH_MSI_CABINET, Buffer.alloc(36))
      return { stdout: JSON.stringify(metadata), stderr: '' }
    })
    await expect(extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)).rejects.toMatchObject({ stage: 'database' })
    expect(commands.run).toHaveBeenCalledTimes(1)
  })

  it.each(['null', '[]', '"text"', '', '{} trailing output', '{}\n{}', 'banner\n{}'])('rejects non-metadata reader output %s', async stdout => {
    const { root, msi } = await fixture()
    commands.run.mockResolvedValueOnce({ stdout, stderr: '' })
    await expect(extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)).rejects.toMatchObject({ stage: 'database' })
    expect(commands.run).toHaveBeenCalledTimes(1)
  })

  it('rejects a linked cabinet rather than passing its target to expand', async () => {
    const { root, msi } = await fixture()
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    commands.stat.mockImplementation(async path => Object.assign(await actual.lstat(path), { isSymbolicLink: () => true }))
    await expect(extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)).rejects.toMatchObject({ stage: 'database' })
    expect(commands.run).toHaveBeenCalledTimes(1)
    expect(await readdir(root)).not.toContain('cabinet')
  })

  it('rejects a preexisting extraction directory rather than writing into it', async () => {
    const { root, msi } = await fixture()
    await writeFile(join(root, 'cabinet'), 'do not replace')
    await expect(extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)).rejects.toMatchObject({ stage: 'cabinet' })
    expect(await readFile(join(root, 'cabinet'), 'utf8')).toBe('do not replace')
    expect(commands.run).toHaveBeenCalledTimes(1)
  })

  it('classifies a timed out reader and never starts cabinet expansion', async () => {
    const { root, msi } = await fixture()
    commands.run.mockRejectedValueOnce(Object.assign(new Error('timed out command with private paths'), { killed: true, signal: 'SIGTERM', code: null }))
    await expect(extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)).rejects.toMatchObject({
      message: 'cpolar_extract_database_failed', nativeCode: null, signal: 'SIGTERM', killed: true, deadlineMs: 120_000,
      cause: { code: null, signal: 'SIGTERM', killed: true, deadlineMs: 120_000 },
    })
    expect(commands.run).toHaveBeenCalledTimes(1)
    expect(await readdir(root)).toEqual(['fixture.msi'])
  })

  it.each(['powershell.exe', 'expand.exe', 'tar.exe'] as const)('classifies missing %s as a tool failure', async tool => {
    commands.run.mockRejectedValueOnce(Object.assign(new Error('ENOENT private executable path'), { code: 'ENOENT' }))
    await expect(cpolarWindowsExtractionStep('database', () => runCpolarWindowsTool(tool, []))).rejects.toMatchObject({
      message: 'cpolar_extract_tools_failed', stage: 'tools', nativeCode: 'ENOENT', deadlineMs: 120_000,
    })
  })

  it('rejects extra or wrong-sized cabinet output instead of promoting it', async () => {
    const { root, msi } = await fixture()
    commands.run.mockImplementationOnce(async (_file, _args, options) => {
      await writeFile(options.env.DSH_MSI_CABINET, Buffer.alloc(36))
      return { stdout: JSON.stringify({ Member: member, Bytes: 4, CabinetBytes: 36 }), stderr: '' }
    }).mockImplementationOnce(async (_file, args) => {
      await writeFile(join(args[2], member), 'wrong size')
      await writeFile(join(args[2], 'unexpected.exe'), 'extra')
      return { stdout: '', stderr: '' }
    })
    await expect(extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)).rejects.toMatchObject({ stage: 'file' })
    expect(await readdir(root)).not.toContain('cpolar.exe')
  })

  it.each(['database', 'cabinet', 'archive'] as const)('redacts subprocess details at %s', async stage => {
    const secret = 'private-path-and-account-token'
    const raw = Object.assign(new Error(`powershell.exe ${secret}`), { code: 5, stderr: secret, stdout: secret, path: secret })
    try {
      await cpolarWindowsExtractionStep(stage, async () => { throw raw })
      throw new Error('fixture must reject')
    } catch (error) {
      expect(error).toMatchObject({ message: `cpolar_extract_${stage}_failed`, stage, nativeCode: 5 })
      expect(inspect(error)).not.toContain(secret)
    }
  })

  it('does not choose a PATH binary when the system root is absent or relative', () => {
    for (const root of [undefined, 'relative', '\\\\host\\share']) {
      vi.stubGlobal('process', { ...process, platform: 'win32', env: { SystemRoot: root, PATH: 'untrusted' } })
      expect(() => cpolarWindowsSystemTool('powershell.exe')).toThrow('cpolar_extract_tools_failed')
    }
    expect(commands.run).not.toHaveBeenCalled()
  })

  it('rejects unsupported platforms and unsafe input before starting a process', async () => {
    const { root, msi } = await fixture()
    await expect(extractWindowsMsiBinary(msi, root, '../cpolar.exe', 4)).rejects.toMatchObject({ nativeCode: 'INPUT_INVALID' })
    vi.stubGlobal('process', { ...process, platform: 'linux' })
    await expect(extractWindowsMsiBinary(msi, root, 'cpolar.exe', 4)).rejects.toMatchObject({ nativeCode: 'INPUT_INVALID' })
    expect(commands.run).not.toHaveBeenCalled()
  })
})
