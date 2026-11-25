import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readlink } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Scrollback retained per terminal so a remounted panel can replay its screen. */
const MAX_BUFFER_BYTES = 256 * 1024;

/** Retained terminals per Session, matching IDEA's default tab ceiling. */
const MAX_TERMINALS_PER_SESSION = 6;

/** PTY dimensions accepted from the browser. */
const MIN_COLS = 2;
const MAX_COLS = 500;
const MIN_ROWS = 1;
const MAX_ROWS = 200;

/**
 * Read the current working directory of one terminal process.
 *
 * OSC 7 is the preferred source because it is shell-owned and cheap. Some
 * shells never emit it, so the Host falls back to the process table on demand.
 * @param {number} pid - top-level terminal process id.
 * @returns {Promise<string|null>} absolute cwd, or null when unavailable.
 */
export async function terminalProcessCwd(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  if (process.platform === 'linux') {
    const cwd = await readlink(`/proc/${pid}/cwd`).catch(() => null);
    return typeof cwd === 'string' && cwd !== '' ? cwd : null;
  }
  if (process.platform === 'darwin') {
    const { stdout } = await execFileAsync('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      timeout: 2000,
      maxBuffer: 64 * 1024,
    }).catch(() => ({ stdout: '' }));
    const line = stdout.split('\n').find((entry) => entry.startsWith('n'));
    return line === undefined ? null : line.slice(1);
  }
  return null;
}

/** One retained shell plus the subscribers currently following its screen. */
class TerminalSession {
  /**
   * @param {string} id - terminal identity used by the browser.
   * @param {string} sessionId - owning Session.
   * @param {object} handle - PTY handle from `ctx.subprocess.spawnTerminal`.
   * @param {{title: string, shell: string, cwd: string}} meta - display metadata.
   */
  constructor(id, sessionId, handle, meta) {
    this.id = id;
    this.sessionId = sessionId;
    this.handle = handle;
    this.meta = meta;
    this.state = 'running';
    this.exitCode = null;
    /* Display position inside the dock; a drag-reorder rewrites it. */
    this.order = 0;
    this.chunks = [];
    this.bytes = 0;
    this.subscribers = new Set();
    this.disposed = false;
  }

  /** Append one PTY output chunk and fan it out to live subscribers. */
  push(data) {
    if (this.disposed || data === '') return;
    this.chunks.push(data);
    this.bytes += Buffer.byteLength(data, 'utf8');
    while (this.bytes > MAX_BUFFER_BYTES && this.chunks.length > 1) {
      this.bytes -= Buffer.byteLength(this.chunks.shift(), 'utf8');
    }
    for (const subscriber of this.subscribers) subscriber({ type: 'data', data });
  }

  /** Retained screen, replayed when a view attaches. */
  snapshot() {
    return this.chunks.join('');
  }

  /** Public description exchanged with the browser. */
  describe() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      title: this.meta.title,
      manualTitle: this.meta.manualTitle === true,
      shell: this.meta.shell,
      cwd: this.meta.cwd,
      state: this.state,
      exitCode: this.exitCode,
      order: this.order,
    };
  }

  /**
   * Attach one subscriber, replaying the retained screen first.
   * @param {(event: object) => void} sink - event consumer.
   * @returns {() => void} detach callback.
   */
  attach(sink) {
    this.subscribers.add(sink);
    sink({ type: 'snapshot', data: this.snapshot(), ...this.describe() });
    return () => {
      this.subscribers.delete(sink);
    };
  }

  /** Terminate the process range once. */
  async terminate() {
    if (this.disposed) return;
    this.disposed = true;
    this.subscribers.clear();
    try {
      await this.handle.terminate();
    } catch {
      /* an already-dead process is not a failure for the panel */
    }
  }
}

/**
 * Session-scoped terminal registry over the host's PTY provider.
 *
 * The panel owns presentation only: processes, screen retention and reconnects
 * live here so collapsing the Editor or switching tool windows never kills a
 * running shell.
 */
export class TerminalHub {
  /**
   * @param {object} options - owning context and PTY provider.
   * @param {object} options.ctx - Cordis context owning disposal.
   * @param {object|undefined} options.subprocess - `ctx.subprocess` provider.
   */
  constructor({ ctx, subprocess }) {
    this.ctx = ctx;
    this.subprocess = subprocess;
    /** @type {Map<string, Map<string, TerminalSession>>} */
    this.sessions = new Map();
    ctx.effect(() => async () => {
      const pending = [];
      for (const terminals of this.sessions.values()) {
        for (const terminal of terminals.values()) pending.push(terminal.terminate());
      }
      this.sessions.clear();
      await Promise.all(pending);
    }, 'dsh-editor: terminal teardown');
  }

  /** Whether the composition mounted a terminal-capable PTY provider. */
  available() {
    return typeof this.subprocess?.spawnTerminal === 'function';
  }

  /**
   * Retained terminals for one Session, oldest first.
   * @param {string} sessionId - Session identity.
   * @returns {object[]} public descriptions.
   */
  list(sessionId) {
    return [...(this.sessions.get(sessionId)?.values() ?? [])]
      .map((terminal) => terminal.describe())
      .sort((left, right) => left.order - right.order);
  }

  /**
   * Resolve one live terminal's current directory without relying on OSC 7.
   * @param {string} sessionId - Session identity.
   * @param {string} id - terminal identity.
   * @returns {Promise<string>} current or initial cwd.
   */
  async cwd(sessionId, id) {
    const terminal = this.sessions.get(sessionId)?.get(id);
    if (terminal === undefined) throw new Error('terminal not found');
    const cwd = await terminalProcessCwd(terminal.handle?.pid);
    if (cwd !== null) terminal.meta.cwd = cwd;
    return terminal.meta.cwd;
  }

  /**
   * Reorder the dock's tabs.
   *
   * The browser sends the complete id list in display order; ids the host no
   * longer knows are ignored so a stale tab cannot corrupt the ordering.
   * @param {string} sessionId - Session identity.
   * @param {string[]} ids - terminal ids in the new order.
   * @returns {object[]} refreshed descriptions in the new order.
   */
  reorder(sessionId, ids) {
    const terminals = this.sessions.get(sessionId);
    if (terminals === undefined) return [];
    if (!Array.isArray(ids)) throw new Error('a terminal order is required');
    const ordered = ids.filter((id) => terminals.has(id));
    /* Terminals the browser did not mention keep their relative order after the rest. */
    for (const id of terminals.keys()) if (!ordered.includes(id)) ordered.push(id);
    ordered.forEach((id, index) => {
      terminals.get(id).order = index;
    });
    return this.list(sessionId);
  }

  /**
   * Start a shell in the Session workspace.
   * @param {object} input - creation request.
   * @param {string} input.sessionId - Session identity.
   * @param {string} input.cwd - absolute workspace root.
   * @param {number} input.cols - starting columns.
   * @param {number} input.rows - starting rows.
   * @returns {Promise<object>} created terminal description.
   */
  async create({ sessionId, cwd, cols, rows, shellPath }) {
    if (!this.available()) throw new Error('this composition has no terminal provider');
    let terminals = this.sessions.get(sessionId);
    if (terminals === undefined) {
      terminals = new Map();
      this.sessions.set(sessionId, terminals);
    }
    if (terminals.size >= MAX_TERMINALS_PER_SESSION) {
      throw new Error(`at most ${MAX_TERMINALS_PER_SESSION} terminals are retained per Session`);
    }
    const shell = typeof shellPath === 'string' && shellPath !== '' ? await this.profileFor(shellPath) : await this.resolveShell();
    const id = randomUUID();
    const width = clamp(cols, MIN_COLS, MAX_COLS, 80);
    const height = clamp(rows, MIN_ROWS, MAX_ROWS, 24);
    const handle = await this.subprocess.spawnTerminal({
      argv: [shell.path, ...shell.args],
      cwd,
      cols: width,
      rows: height,
      terminalType: 'xterm-256color',
      graceMs: 1500,
    });
    const terminal = new TerminalSession(id, sessionId, handle, {
      title: shell.name,
      shell: shell.path,
      cwd,
    });
    terminal.order = terminals.size;
    terminals.set(id, terminal);
    handle.output.setEncoding('utf8');
    handle.output.on('data', (data) => terminal.push(data));
    handle.done.then(
      (outcome) => {
        terminal.state = 'exited';
        terminal.exitCode = outcome?.exitCode ?? null;
        for (const subscriber of terminal.subscribers) {
          subscriber({ type: 'exit', code: terminal.exitCode, info: terminal.describe() });
        }
      },
      () => {
        terminal.state = 'exited';
        for (const subscriber of terminal.subscribers) subscriber({ type: 'exit', code: null, info: terminal.describe() });
      },
    );
    return terminal.describe();
  }

  /**
   * Build one shell profile from an explicit executable path.
   * @param {string} candidate - absolute path or bare name chosen by the user.
   * @returns {Promise<{path: string, name: string, args: string[]}>} shell profile.
   */
  async profileFor(candidate) {
    const path = await this.subprocess.resolveExecutable(candidate);
    const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
    const lowered = name.toLowerCase().replace(/\.exe$/u, '');
    const args = lowered === 'cmd' ? [] : lowered === 'pwsh' || lowered === 'powershell' ? ['-NoLogo'] : ['-i'];
    return { path, name, args };
  }

  /**
   * Discover the installed shells the picker offers, default first.
   * @returns {Promise<object[]>} `{path, name}` entries that resolved.
   */
  async shells() {
    if (!this.available()) return [];
    const environment = await this.subprocess.terminalEnvironment().catch(() => undefined);
    const candidates = [environment?.defaultShell, 'zsh', 'bash', 'fish', 'pwsh', 'powershell', 'sh'].filter(
      (value) => typeof value === 'string' && value !== '',
    );
    const found = new Map();
    for (const candidate of candidates) {
      try {
        const path = await this.subprocess.resolveExecutable(candidate);
        const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
        const key = name.toLowerCase().replace(/\.exe$/u, '');
        if (!found.has(key)) found.set(key, { path, name });
      } catch {
        /* a missing shell is simply not offered */
      }
    }
    return [...found.values()];
  }

  /**
   * Resolve the environment's default shell without assuming a path exists.
   * @returns {Promise<{path: string, name: string, args: string[]}>} shell profile.
   */
  async resolveShell() {
    const environment = await this.subprocess.terminalEnvironment();
    return this.profileFor(environment?.defaultShell ?? process.env.SHELL ?? '/bin/sh');
  }

  /**
   * Write browser keystrokes to one terminal.
   * @param {string} sessionId - Session identity.
   * @param {string} id - terminal identity.
   * @param {string} data - raw terminal input.
   */
  async write(sessionId, id, data) {
    const terminal = this.require(sessionId, id);
    if (typeof data !== 'string' || data === '') return;
    await terminal.handle.write(data);
  }

  /**
   * Resize one PTY.
   * @param {string} sessionId - Session identity.
   * @param {string} id - terminal identity.
   * @param {number} cols - measured columns.
   * @param {number} rows - measured rows.
   */
  async resize(sessionId, id, cols, rows) {
    const terminal = this.require(sessionId, id);
    const width = clamp(cols, MIN_COLS, MAX_COLS, 80);
    const height = clamp(rows, MIN_ROWS, MAX_ROWS, 24);
    if (terminal.lastCols === width && terminal.lastRows === height) return;
    terminal.lastCols = width;
    terminal.lastRows = height;
    await terminal.handle.resize(width, height);
  }

  /**
   * Rename one terminal tab.
   *
   * `auto` marks a shell-published (OSC) title: a user rename wins, so an
   * automatic title can never overwrite a name the user typed.
   * @param {string} sessionId - Session identity.
   * @param {string} id - terminal identity.
   * @param {string} title - new display name.
   * @param {boolean} [auto] - whether the shell published this title.
   * @returns {object} refreshed description.
   */
  rename(sessionId, id, title, auto = false) {
    const terminal = this.require(sessionId, id);
    const trimmed = typeof title === 'string' ? title.trim() : '';
    if (trimmed === '') return terminal.describe();
    if (auto === true && terminal.meta.manualTitle === true) return terminal.describe();
    if (auto !== true) terminal.meta.manualTitle = true;
    terminal.meta.title = trimmed.slice(0, 80);
    return terminal.describe();
  }

  /**
   * Terminate one terminal and forget it.
   * @param {string} sessionId - Session identity.
   * @param {string} id - terminal identity.
   * @returns {Promise<{id: string, closed: true}>} closure acknowledgement.
   */
  async close(sessionId, id) {
    const terminals = this.sessions.get(sessionId);
    const terminal = terminals?.get(id);
    if (terminal === undefined) return { id, closed: true };
    terminals.delete(id);
    if (terminals.size === 0) this.sessions.delete(sessionId);
    await terminal.terminate();
    return { id, closed: true };
  }

  /**
   * Follow one terminal's screen until the returned detach runs.
   * @param {string} sessionId - Session identity.
   * @param {string} id - terminal identity.
   * @param {(event: object) => void} sink - event consumer.
   * @returns {() => void} detach callback.
   */
  attach(sessionId, id, sink) {
    const terminal = this.require(sessionId, id);
    return terminal.attach(sink);
  }

  /**
   * Look up one live terminal or fail with a stable message.
   * @param {string} sessionId - Session identity.
   * @param {string} id - terminal identity.
   * @returns {TerminalSession} retained terminal.
   */
  require(sessionId, id) {
    const terminal = this.sessions.get(sessionId)?.get(id);
    if (terminal === undefined) throw new Error('terminal no longer exists in this Session');
    return terminal;
  }
}

/**
 * Clamp one numeric dimension into the PTY range.
 * @param {unknown} value - browser-supplied number.
 * @param {number} min - lower bound.
 * @param {number} max - upper bound.
 * @param {number} fallback - value used when the input is not a number.
 * @returns {number} safe integer dimension.
 */
function clamp(value, min, max, fallback) {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * Encode one event as a Server-Sent Events frame.
 * @param {object} event - event payload.
 * @returns {Uint8Array} encoded frame.
 */
export function encodeSse(event) {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}
