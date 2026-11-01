// 把 '2026-10-28 21:00:00' 变成 '2026.10.28'
export function formatDate(value) {
  if (!value) return ''
  const datePart = String(value).split(' ')[0]
  return datePart.replace(/-/g, '.')
}

// 把 '2026-10-28 21:00:00' 变成 '10.28 21:00'
export function formatDateTime(value) {
  if (!value) return ''
  const [datePart, timePart = ''] = String(value).split(' ')
  const [, month, day] = datePart.split('-')
  return `${month}.${day} ${timePart.slice(0, 5)}`
}
