export interface MarkdownScrollBox {
  scrollTop?: unknown;
  scrollHeight?: unknown;
  clientHeight?: unknown;
}

export function markdownScrollRatio(box: MarkdownScrollBox | null | undefined): number {
  const scrollTop = Number(box?.scrollTop);
  const scrollHeight = Number(box?.scrollHeight);
  const clientHeight = Number(box?.clientHeight);
  if (!Number.isFinite(scrollTop) || !Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight)) {
    return 0;
  }
  const maximum = scrollHeight - clientHeight;
  if (clientHeight <= 0 || maximum <= 0) return 0;
  return Math.min(1, Math.max(0, scrollTop / maximum));
}

export function markdownScrollTopForRatio(
  ratio: unknown,
  box: Pick<MarkdownScrollBox, 'scrollHeight' | 'clientHeight'> | null | undefined,
): number {
  const scrollHeight = Number(box?.scrollHeight);
  const clientHeight = Number(box?.clientHeight);
  const maximum = scrollHeight - clientHeight;
  const normalized = Number(ratio);
  if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight) || clientHeight <= 0 || maximum <= 0) {
    return 0;
  }
  if (!Number.isFinite(normalized) || normalized <= 0) return 0;
  return Math.min(1, normalized) * maximum;
}
