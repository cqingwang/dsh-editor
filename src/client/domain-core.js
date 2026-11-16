/* domain-core.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
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
      md: 'markdown',
      markdown: 'markdown',
      mdx: 'markdown',
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
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'ini',
      ini: 'ini',
      xml: 'xml',
      svg: 'xml',
      sql: 'sql',
      kt: 'kotlin',
      kts: 'kotlin',
      swift: 'swift',
      dart: 'dart',
      lua: 'lua',
      r: 'r',
      dockerfile: 'dockerfile',
      makefile: 'makefile',
    };

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
