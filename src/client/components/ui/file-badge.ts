export interface FileBadgeInfo {
  label: string;
  color: string;
  background: string;
}

/** Fallback file-type badge used when the host does not provide its artwork. */
export function fileBadge(path?: string): FileBadgeInfo | null {
  const normalized = typeof path === 'string' ? path.replaceAll('\\', '/') : '';
  const name = (normalized.split('/').pop() ?? '').toLowerCase();
  const dot = name.lastIndexOf('.');
  const extension = dot < 0 ? name : name.slice(dot + 1);
  switch (extension) {
    case 'json':
      return { label: '{}', color: '#2f65ca', background: '#e6efff' };
    case 'yaml':
    case 'yml':
      return { label: 'YML', color: '#b3261e', background: '#fde8e7' };
    case 'py':
    case 'pyw':
      return { label: 'Py', color: '#1f6fb2', background: '#e3f2fd' };
    case 'sh':
    case 'bash':
    case 'zsh':
      return { label: '>_', color: '#1b7f4b', background: '#e6f4ea' };
    case 'md':
    case 'markdown':
      return { label: 'MD', color: '#2f65ca', background: '#e6efff' };
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return { label: 'TS', color: '#1d5fa8', background: '#e3efff' };
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return { label: 'JS', color: '#8a6d00', background: '#fff4c2' };
    case 'go':
      return { label: 'GO', color: '#00758f', background: '#dff6f9' };
    case 'rs':
      return { label: 'RS', color: '#9c4a1a', background: '#fbe9dd' };
    case 'java':
    case 'kt':
    case 'kts':
      return { label: 'J', color: '#a14a00', background: '#fbe9dd' };
    case 'c':
    case 'h':
    case 'cc':
    case 'cpp':
    case 'cxx':
    case 'hpp':
      return { label: 'C', color: '#3f51b5', background: '#e8eaf6' };
    case 'html':
    case 'htm':
    case 'vue':
    case 'svelte':
      return { label: '<>', color: '#b34a00', background: '#fbe9dd' };
    case 'css':
    case 'scss':
    case 'less':
      return { label: '#', color: '#1565c0', background: '#e3f2fd' };
    case 'toml':
    case 'ini':
    case 'conf':
      return { label: 'T', color: '#5f6368', background: '#eceff1' };
    case 'xml':
    case 'svg':
      return { label: '<>', color: '#b34a00', background: '#fbe9dd' };
    case 'sql':
      return { label: 'DB', color: '#00695c', background: '#e0f2f1' };
    case 'lock':
      return { label: 'L', color: '#5f6368', background: '#eceff1' };
    default:
      if (name === '.gitignore' || name === '.gitmodules') {
        return { label: 'G', color: '#5f6368', background: '#eceff1' };
      }
      if (name === '.think_plan.md') {
        return { label: 'MD', color: '#2f65ca', background: '#e6efff' };
      }
      return null;
  }
}
