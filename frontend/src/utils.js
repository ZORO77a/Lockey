// helper utils used in multiple components
export function formatDateISOString(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString() } catch { return iso }
}
