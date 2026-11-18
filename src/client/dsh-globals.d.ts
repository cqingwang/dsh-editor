import type * as Monaco from 'monaco-editor';

declare global {
  interface Navigator {
    userAgentData?: {
      platform?: string;
    };
  }

  interface DshAmdRequire {
    (dependencies: string[], callback: () => void, errorCallback?: (error: unknown) => void): void;
    config(options: Record<string, unknown>): void;
  }

  interface Window {
    __dshEditorChatWheel?: boolean;
    __dshEditorTypeScriptConfig?: {
      target?: string;
      lib?: string[];
      jsx?: string;
      jsxImportSource?: string;
      downlevelIteration?: boolean;
      allowSyntheticDefaultImports?: boolean;
      resolveJsonModule?: boolean;
    };
    monaco?: typeof Monaco;
    require?: DshAmdRequire;
    MonacoEnvironment?: {
      getWorkerUrl: () => string;
    };
  }

  interface HTMLElement {
    __dshTerminalVisibilityObserver?: ResizeObserver;
  }
}

declare module '/api/dsh-editor/xterm/xterm.mjs' {
  export const Terminal: unknown;
}

declare module '/api/dsh-editor/xterm/addon-fit.mjs' {
  export const FitAddon: unknown;
}

declare module '/api/dsh-editor/shared/link-parser.mjs' {
  export const parseTerminalLinks: unknown;
  export const resolveTerminalPath: unknown;
}

declare module 'monaco-editor' {
  interface ITextModel {
    __dshRestoreListener?: { dispose: () => void };
    __dshFallbackUndo?: { dispose: () => void };
  }
}

export {};
