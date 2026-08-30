/**
 * Returns a simple emoji avatar for an agent based on their role.
 * No external assets are used.
 */
export function getRoleEmoji(role: string): string {
  const lower = role.toLowerCase()
  if (lower.includes('ceo')) return '👔'
  if (lower.includes('qa')) return '🧪'
  if (lower.includes('support')) return '🎧'
  if (lower.includes('review')) return '🔍'
  if (lower.includes('devops')) return '⚙️'
  if (lower.includes('security')) return '🛡️'
  if (lower.includes('design') || lower.includes('ui') || lower.includes('ux')) return '🎨'
  if (lower.includes('frontend')) return '💻'
  if (lower.includes('backend')) return '⚙️'
  if (lower.includes('writer') || lower.includes('doc')) return '📝'
  if (lower.includes('product') || lower.includes('manager')) return '📋'
  if (lower === 'default') return '🧑‍💻'
  return '🧑‍💻'
}
