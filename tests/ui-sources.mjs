import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

export const activityStripeSource = read('src/client/components/ui/ActivityStripe.tsx');
export const compactActionBarSource = read('src/client/components/ui/CompactActionBar.tsx');
export const diffViewModeControlSource = read('src/client/components/ui/DiffViewModeControl.tsx');
export const diffModelSource = read('src/client/components/ui/diff-model.ts');
export const gitStatusBadgeSource = read('src/client/components/ui/GitStatusBadge.tsx');
export const gitChangeModelSource = read('src/client/components/ui/git-change-model.ts');
export const gitStatusModelSource = read('src/client/components/ui/git-status-model.ts');
export const iconSource = read('src/client/components/ui/Icon.tsx');
export const menuSource = read('src/client/components/ui/Menu.tsx');
export const menuModelSource = read('src/client/components/ui/menu-model.ts');
export const panelToolbarSource = read('src/client/components/ui/PanelToolbar.tsx');
export const toolbarButtonSource = read('src/client/components/ui/ToolbarButton.tsx');
export const toolbarModelSource = read('src/client/components/ui/toolbar-model.ts');
