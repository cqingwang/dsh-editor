/* domain-core.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    /**
     * Whole filenames that do not follow an extension-only language mapping.
     * Keys are lower-case because users routinely type mixed-case filenames.
     */
    const LANGUAGE_BY_FILENAME = {
      'cargo.lock': 'yaml',
      'deno.lock': 'json',
      'bun.lock': 'json',
      'composer.lock': 'json',
      'pipfile.lock': 'json',
      'poetry.lock': 'ini',
      'uv.lock': 'ini',
      'yarn.lock': 'yaml',
      'go.mod': 'go',
      'go.sum': 'go',
      'dockerfile': 'dockerfile',
      'containerfile': 'dockerfile',
      'makefile': 'makefile',
      'gnumakefile': 'makefile',
      'gemfile': 'ruby',
      'rakefile': 'ruby',
      'podfile': 'ruby',
      'vagrantfile': 'ruby',
      'brewfile': 'ruby',
      'procfile': 'shell',
      'pipfile': 'ini',
      '.editorconfig': 'ini',
      '.gitconfig': 'ini',
      '.gitmodules': 'ini',
      '.npmrc': 'ini',
      '.yarnrc': 'ini',
      '.env': 'ini',
      '.eslintrc': 'json',
      '.prettierrc': 'json',
      '.babelrc': 'json',
      '.stylelintrc': 'json',
    };

    const LANGUAGE_BY_EXTENSION = {
      ts: 'typescript',
      tsx: 'typescript',
      mts: 'typescript',
      cts: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      json: 'json',
      jsonc: 'json',
      json5: 'json',
      jsonl: 'json',
      ndjson: 'json',
      geojson: 'json',
      webmanifest: 'json',
      md: 'markdown',
      markdown: 'markdown',
      mdx: 'mdx',
      css: 'css',
      scss: 'scss',
      less: 'less',
      html: 'html',
      htm: 'html',
      vue: 'html',
      svelte: 'html',
      py: 'python',
      pyw: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c',
      h: 'c',
      cc: 'cpp',
      cpp: 'cpp',
      cxx: 'cpp',
      hpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      sh: 'shell',
      bash: 'shell',
      zsh: 'shell',
      ps1: 'powershell',
      bat: 'bat',
      cmd: 'bat',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'ini',
      ini: 'ini',
      conf: 'ini',
      cfg: 'ini',
      properties: 'ini',
      env: 'ini',
      xml: 'xml',
      svg: 'xml',
      sql: 'sql',
      kt: 'kotlin',
      kts: 'kotlin',
      swift: 'swift',
      dart: 'dart',
      lua: 'lua',
      r: 'r',
      graphql: 'graphql',
      gql: 'graphql',
      proto: 'protobuf',
      tf: 'hcl',
      tfvars: 'hcl',
      hcl: 'hcl',
      sol: 'solidity',
      rst: 'restructuredtext',
      fs: 'fsharp',
      fsx: 'fsharp',
      scala: 'scala',
      clj: 'clojure',
      cljs: 'clojure',
      cljc: 'clojure',
      edn: 'clojure',
      ex: 'elixir',
      exs: 'elixir',
      jl: 'julia',
      coffee: 'coffee',
      liquid: 'liquid',
      hbs: 'handlebars',
      handlebars: 'handlebars',
      mustache: 'handlebars',
      pug: 'pug',
      jade: 'pug',
      cshtml: 'razor',
      tcl: 'tcl',
      vb: 'vb',
      pas: 'pascal',
      pl: 'perl',
      pm: 'perl',
      dockerfile: 'dockerfile',
      makefile: 'makefile',
    };

    /**
     * 解析 IDEA Go to Line/Column 输入。
     *
     * 接受单独行号 `12`，也接受 `12:7` 或 `12,7`；行列都必须是
     * 从 1 开始的安全整数，其他文本保持输入框打开供用户修正。
     * @param {unknown} value - 输入框原始文本。
     * @returns {{line: number, column: number}|null} 目标位置。
     */
    function parseGotoLinePosition(value) {
      const match = /^(\d+)(?:\s*[:,]\s*(\d+))?$/u.exec(String(value ?? '').trim());
      if (match === null) return null;
      const line = Number(match[1]);
      const column = match[2] === undefined ? 1 : Number(match[2]);
      if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || line < 1 || column < 1) return null;
      return { line, column };
    }

    /** 判断键盘事件是否为非组合输入状态下的 `⌘/Ctrl+L`。 */
    function gotoLineShortcutMatches(event) {
      if (event === null || typeof event !== 'object' || event.isComposing === true) return false;
      return event.key?.toLowerCase?.() === 'l'
        && (event.metaKey === true || event.ctrlKey === true)
        && event.altKey !== true
        && event.shiftKey !== true;
    }

    /**
     * The skeleton IDEA's "New from Template" writes for a file name.
     *
     * IDEA's File Templates are per-language, not one blank file: a `.ts` file
     * arrives with an export marker, a `.md` with a title, a test with a `describe`
     * skeleton. Only the common cases are covered here — an unknown extension must
     * stay a genuinely empty file rather than gain boilerplate nobody asked for.
     * @param {string} name - the file name being created (its extension decides).
     * @returns {string} starter content, possibly empty.
     */
    function templateFor(name) {
      const clean = typeof name === 'string' ? name.trim() : '';
      const dot = clean.lastIndexOf('.');
      if (dot <= 0 || dot === clean.length - 1) return '';
      const extension = clean.slice(dot + 1).toLowerCase();
      const base = clean.slice(0, dot);
      switch (extension) {
        case 'ts':
        case 'tsx':
          return 'export {};\n';
        case 'js':
        case 'jsx':
        case 'mjs':
        case 'cjs':
          return "'use strict';\n";
        case 'py':
          return `"""${base}."""\n`;
        case 'md':
        case 'markdown':
          return `# ${base}\n`;
        case 'go':
          return 'package main\n';
        case 'sh':
        case 'bash':
        case 'zsh':
          return '#!/usr/bin/env bash\nset -euo pipefail\n';
        case 'json':
          return '{}\n';
        case 'css':
          return '';
        case 'html':
          return `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>${base}</title>\n  </head>\n  <body></body>\n</html>\n`;
        default:
          /* No opinion: an unknown extension keeps the blank file. */
          return '';
      }
    }

    /**
     * Identity of the pinned Commit-diff tab inside the editor's strip.
     *
     * A NUL prefix cannot collide with a workspace path, so the strip can treat
     * this key and a file path in the same overflow list without a type check.
     */
    const DIFF_TAB_KEY = '\u0000dsh-editor-diff';

    /** Trebuchet MS is the requested default for editor chrome and code text. */
    const EDITOR_UI_FONT = '"Trebuchet MS", "PingFang SC", "Microsoft YaHei UI", sans-serif';
    /** One code text size across every Monaco editing surface. */
    const EDITOR_CODE_FONT_SIZE = 13;
    /** One line height across every Monaco editing surface. */
    const EDITOR_CODE_LINE_HEIGHT = 20;
    /** IDEA Markdown modes: Editor / Editor and Preview / Preview. */
    const MARKDOWN_MODES = new Set(['code', 'split', 'preview']);

    /**
     * Normalize the persisted Markdown view mode.
     * @param {unknown} value - stored or requested mode.
     * @returns {'code'|'split'|'preview'} a supported mode.
     */
    function normalizeMarkdownMode(value) {
      return typeof value === 'string' && MARKDOWN_MODES.has(value) ? value : 'code';
    }

    /**
     * Whether a path is handled by the Markdown preview.
     * @param {unknown} path - workspace-relative path.
     * @returns {boolean} true for Markdown/MDX documents.
     */
    function isMarkdownPath(path) {
      return typeof path === 'string' && /\.(?:md|markdown|mdx)$/iu.test(path);
    }

    /**
     * Whether a workspace file is rendered by the browser's native image decoder.
     * @param {unknown} path - workspace-relative path.
     * @returns {boolean} true for supported still-image extensions.
     */
    function isImagePreviewPath(path) {
      return typeof path === 'string' && /\.(?:png|jpe?g|jfif|gif|webp|avif|bmp|ico|svg)$/iu.test(path);
    }

    /**
     * Resolve a local Markdown link against the document that contains it.
     * @param {string} basePath - workspace-relative Markdown path.
     * @param {string} target - authored link target.
     * @returns {string|null} workspace-relative file path, or null for external/anchor links.
     */
    function resolveMarkdownLink(basePath, target) {
      if (typeof basePath !== 'string' || typeof target !== 'string') return null;
      const authored = target.trim();
      if (authored === '' || authored.startsWith('#') || /^[a-z][a-z0-9+.-]*:/iu.test(authored) || authored.startsWith('//')) return null;
      const clean = authored.split(/[?#]/u, 1)[0].replaceAll('\\', '/');
      let decoded;
      try {
        decoded = decodeURIComponent(clean);
      } catch {
        decoded = clean;
      }
      const parts = [...dirname(basePath).split('/').filter(Boolean), ...decoded.split('/')];
      const normalized = [];
      for (const part of parts) {
        if (part === '' || part === '.') continue;
        if (part === '..') {
          if (normalized.length === 0) return null;
          normalized.pop();
        } else normalized.push(part);
      }
      return normalized.join('/');
    }

    /**
     * Apply IDEA's Project-tree pointer selection semantics.
     *
     * A plain click replaces the selection. ⌘/Ctrl toggles exactly one row while
     * preserving every other selected row. Shift extends a contiguous visible
     * range from the existing anchor. Keeping this as one pure transition avoids
     * updating `selectedPath` from inside a React state updater.
     * @param {{
     *   rows: object[],
     *   selection: Set<string>,
     *   primary: string|null,
     *   anchor: string|null,
     *   path: string,
     *   metaKey?: boolean,
     *   ctrlKey?: boolean,
     *   shiftKey?: boolean,
     * }} request - current tree state and the pointer gesture.
     * @returns {{selection: Set<string>, primary: string|null, anchor: string|null}} next state.
     */
    function projectTreeSelectionAfterPointer(request) {
      const rows = Array.isArray(request?.rows) ? request.rows : [];
      const paths = rows.filter((row) => row?.kind !== 'placeholder').map((row) => row.path);
      const path = typeof request?.path === 'string' ? request.path : '';
      const known = new Set(paths);
      const current = new Set(
        [...(request?.selection instanceof Set ? request.selection : [])]
          .filter((entry) => typeof entry === 'string' && known.has(entry)),
      );
      if (!known.has(path)) {
        return {
          selection: current,
          primary: request?.primary ?? null,
          anchor: request?.anchor ?? null,
        };
      }
      const anchor = typeof request?.anchor === 'string' && known.has(request.anchor)
        ? request.anchor
        : null;
      if (request?.shiftKey === true && anchor !== null) {
        const from = paths.indexOf(anchor);
        const to = paths.indexOf(path);
        const [start, end] = from <= to ? [from, to] : [to, from];
        return {
          selection: new Set(paths.slice(start, end + 1)),
          primary: path,
          anchor,
        };
      }
      if (request?.metaKey === true || request?.ctrlKey === true) {
        if (current.has(path)) current.delete(path);
        else current.add(path);
        let primary = null;
        if (current.has(path)) {
          primary = path;
        } else {
          const remaining = paths.filter((entry) => current.has(entry));
          if (remaining.length > 0) {
            const clickedIndex = paths.indexOf(path);
            primary = remaining[Math.min(clickedIndex, remaining.length - 1)] ?? remaining[remaining.length - 1];
          }
        }
        return {
          selection: current,
          primary,
          anchor: primary,
        };
      }
      return {
        selection: new Set([path]),
        primary: path,
        anchor: path,
      };
    }

    /**
     * Normalize a scroll box to a 0..1 reading position.
     * @param {{scrollTop?: unknown, scrollHeight?: unknown, clientHeight?: unknown}} box - DOM or Monaco scroll measurements.
     * @returns {number} clamped position, or 0 when the surface cannot scroll.
     */
    function markdownScrollRatio(box) {
      const scrollTop = Number(box?.scrollTop);
      const scrollHeight = Number(box?.scrollHeight);
      const clientHeight = Number(box?.clientHeight);
      if (!Number.isFinite(scrollTop) || !Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight)) return 0;
      const maximum = scrollHeight - clientHeight;
      if (clientHeight <= 0 || maximum <= 0) return 0;
      return Math.min(1, Math.max(0, scrollTop / maximum));
    }

    /**
     * Convert a normalized reading position back into a scroll offset.
     * @param {unknown} ratio - requested 0..1 position.
     * @param {{scrollHeight?: unknown, clientHeight?: unknown}} box - target scroll measurements.
     * @returns {number} clamped scrollTop for the target surface.
     */
    function markdownScrollTopForRatio(ratio, box) {
      const scrollHeight = Number(box?.scrollHeight);
      const clientHeight = Number(box?.clientHeight);
      const maximum = scrollHeight - clientHeight;
      const normalized = Number(ratio);
      if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight) || clientHeight <= 0 || maximum <= 0) return 0;
      if (!Number.isFinite(normalized) || normalized <= 0) return 0;
      return Math.min(1, normalized) * maximum;
    }
