// 通用工具函数

/** 计算 SHA-256 十六进制（地址密码登录需要） */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 安全解析日期字符串：无时区信息时按 UTC 解析，避免 +8 时区偏差 */
function toDate(input) {
  if (!input) return new Date(NaN)
  const s = String(input).trim()
  // 已有明确时区标记（Z / ±HH:MM / ±HHMM），直接解析
  if (/[Zz]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    return new Date(s)
  }
  // 否则补 Z 强制按 UTC 解析
  return new Date(s + 'Z')
}

/** 相对时间，例如 "3 分钟前" */
export function timeAgo(input) {
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return ''
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 45) return '刚刚'
  if (diff < 90) return '1 分钟前'
  const mins = Math.round(diff / 60)
  if (mins < 60) return `${mins} 分钟前`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} 小时前`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

/** 完整时间戳 */
export function formatFull(input) {
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 从 "Name <a@b.com>" 提取显示名与地址 */
export function parseAddress(raw) {
  if (!raw) return { name: '', email: '' }
  const m = String(raw).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim(), email: m[2].trim() }
  return { name: '', email: String(raw).trim() }
}

/** 取头像用的两字母缩写 */
export function initials(text) {
  if (!text) return '?'
  const clean = text.replace(/[<>"]/g, '').trim()
  const at = clean.indexOf('@')
  const base = at > 0 ? clean.slice(0, at) : clean
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

/** 基于字符串生成稳定的色相（用于头像底色） */
export function hueFrom(text) {
  let h = 0
  for (let i = 0; i < (text || '').length; i++) {
    h = (h * 31 + text.charCodeAt(i)) % 360
  }
  return h
}

/** 复制到剪贴板 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 解析原始 eml 为 { subject, from, to, text, html }，作为 parsed_mails 的兜底 */
export async function parseRawEml(raw) {
  const { default: PostalMime } = await import('postal-mime')
  const parsed = await PostalMime.parse(raw)
  return {
    subject: parsed.subject || '',
    from: parsed.from?.address
      ? (parsed.from.name ? `${parsed.from.name} <${parsed.from.address}>` : parsed.from.address)
      : '',
    fromName: parsed.from?.name || '',
    to: (parsed.to || []).map((t) => t.address).join(', '),
    text: parsed.text || '',
    html: parsed.html || '',
    attachments: parsed.attachments || [],
  }
}
