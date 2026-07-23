export function buildShareUrl(pt: any): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/share/${pt.id}`
}
