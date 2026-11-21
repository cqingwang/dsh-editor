import type { DefinitionSearchMatch, DefinitionSearchOptions, DefinitionTargetKind } from '../../code-navigation';
import { callFs } from '../../editor-core';

export interface DefinitionPathIdentityResponse {
  requested?: string;
  path?: string;
  identity?: string | null;
}

/** 选择 declaration / implementation 导航失败时使用的本地化 key。 */
export function definitionStatusMessageKey(targetKind: DefinitionTargetKind, outcome: 'notFound' | 'failed'): string {
  if (targetKind === 'implementation') {
    return outcome === 'notFound' ? 'editor.implementationNotFound' : 'editor.implementationFailed';
  }
  return outcome === 'notFound' ? 'editor.definitionNotFound' : 'editor.definitionFailed';
}

interface DefinitionEditorModel {
  getValue(): string;
}

/** 读取声明候选文件，优先使用当前已挂载的 dirty Monaco model。 */
export async function definitionCandidateContent(
  target: string,
  models: ReadonlyMap<string, DefinitionEditorModel>,
): Promise<string> {
  const existing = models.get(target);
  if (existing !== undefined) return existing.getValue();
  const value = await callFs<{ content?: string }>({ op: 'read', path: target });
  return value?.content ?? '';
}

/** 批量读取导航候选的文件系统身份，供大小写和 symlink 别名去重。 */
export async function definitionPathIdentities(paths: string[]): Promise<DefinitionPathIdentityResponse[]> {
  const described = await callFs<DefinitionPathIdentityResponse[]>({ op: 'exists', paths });
  return Array.isArray(described) ? described : [];
}

/** 通过 host 文本搜索寻找声明候选，保持导航解析器的搜索边界。 */
export async function definitionSearchText(
  query: string,
  options?: DefinitionSearchOptions,
): Promise<DefinitionSearchMatch[]> {
  const value = await callFs<{ matches?: DefinitionSearchMatch[] }>({
    op: 'searchText',
    query,
    regex: true,
    maxMatches: 80,
    scopeIncludePatterns: options?.scopeIncludePatterns,
    includeExcluded: (options?.scopeIncludePatterns?.length ?? 0) > 0,
  });
  return Array.isArray(value?.matches) ? value.matches : [];
}
