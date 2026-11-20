/** One-based line numbers containing Git conflict markers. */
export function conflictMarkerLineNumbers(text: string): number[] {
  const source = typeof text === 'string' ? text : '';
  return source
    .split(/\r?\n/u)
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^(?:<{7}(?:\s.*)?|={7}(?:\s.*)?|>{7}(?:\s.*)?)$/u.test(line))
    .map(({ index }) => index + 1);
}
