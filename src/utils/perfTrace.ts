const marks = new Map<string, number>()
const counts = new Map<string, number>()

export function perfStart(label: string): void {
  marks.set(label, performance.now())
}

export function perfEnd(label: string, group = 'default'): number {
  const start = marks.get(label)
  if (start === undefined) return 0
  const dur = performance.now() - start
  marks.delete(label)
  console.log(`[perf:${group}] ${label}: ${dur.toFixed(1)}ms`)
  return dur
}

export async function perfWrap<T>(label: string, group: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    const dur = performance.now() - t0
    console.log(`[perf:${group}] ${label}: ${dur.toFixed(1)}ms`)
  }
}

export function perfCount(label: string): number {
  const n = (counts.get(label) || 0) + 1
  counts.set(label, n)
  console.log(`[perf:count] ${label} -> call #${n}`)
  return n
}

export function perfResetCounts(): void {
  counts.clear()
}
