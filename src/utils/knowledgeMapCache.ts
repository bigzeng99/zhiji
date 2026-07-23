import type { GroupInfo } from './knowledgeMapAdapter'

export interface SubjectMapCacheEntry {
  version: string
  groups: GroupInfo[]
  defaultNodes: any[]
  defaultEdges: any[]
}

// Module-level singleton: survives KnowledgeMap component remounts (the map
// view is excluded from keep-alive, so every navigation creates a fresh
// component instance — this cache must live outside that instance).
const cache = new Map<string, SubjectMapCacheEntry>()

export function getSubjectMapCache(subjectId: string): SubjectMapCacheEntry | undefined {
  return cache.get(subjectId)
}

export function setSubjectMapCache(subjectId: string, entry: SubjectMapCacheEntry): void {
  cache.set(subjectId, entry)
}

export function clearSubjectMapCache(subjectId?: string): void {
  if (subjectId) cache.delete(subjectId)
  else cache.clear()
}
