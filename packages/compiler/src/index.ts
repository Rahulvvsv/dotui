export { extractFile, type ExtractResult } from './extract';
export { makeId, makeSegment, scopeFromFile } from './ids';
export { type FileSchema, type MergeResult, mergeSchemas } from './merge';
export { dotuiBabelPlugin } from './plugin';
export { type DotIdAssignment, assignDotIds, findRootDots } from './walk';
