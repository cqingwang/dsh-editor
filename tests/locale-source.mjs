import { readFile } from 'node:fs/promises';

import { transpileTypeScriptSource } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const executable = transpileTypeScriptSource(source);
const moduleExports = new Function(
  `const VIEW_LABEL = 'Editor';
${executable}
return {
  zh,
  en,
  flattenDictionary,
  interpolateMessage,
  searchReplaceCountParams,
  englishMessages,
  commitEnglish,
  inject,
};`,
)();

export const localeSource = source;
export const zh = moduleExports.zh;
export const en = moduleExports.en;
export const flattenDictionary = moduleExports.flattenDictionary;
export const interpolateMessage = moduleExports.interpolateMessage;
export const searchReplaceCountParams = moduleExports.searchReplaceCountParams;
export const englishMessages = moduleExports.englishMessages;
export const commitEnglish = moduleExports.commitEnglish;
export const inject = moduleExports.inject;
