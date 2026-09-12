import DOMPurify from 'dompurify'
import { Marked } from 'marked'

const parser = new Marked({ gfm: true, breaks: false, async: false })

export function sanitizeMarkdownHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style'],
    FORBID_ATTR: ['style'],
  })
}

export function renderMarkdown(source: string): string {
  return sanitizeMarkdownHTML(parser.parse(source.replace(/^\uFEFF/, ''), { async: false }))
}

export function isMarkdownFile(file?: {
  file_name?: string
  file_type?: string
  mime_type?: string
  content_doctype?: string
  is_folder?: boolean | number
} | null): boolean {
  if (!file || file.is_folder || file.content_doctype) return false
  const mimeType = file.mime_type?.split(';')[0].trim().toLowerCase()
  return file.file_type === 'Markdown' ||
    mimeType === 'text/markdown' || mimeType === 'text/x-markdown' ||
    /\.(md|markdown)$/i.test(file.file_name || '')
}
