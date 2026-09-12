import { describe, expect, it } from 'vitest'
import { isMarkdownFile, renderMarkdown } from './markdown'

function render(source: string) {
  const root = document.createElement('div')
  root.innerHTML = renderMarkdown(source)
  return root
}

describe('Markdown rendering', () => {
  it('renders headings, emphasis, lists, tables, tasks and fenced code', () => {
    const root = render([
      '# Project', '', '**Ready** and ~~obsolete~~', '', '> A quote', '',
      '- [x] Done', '- [ ] Pending', '', '1. First', '2. Second', '',
      '| Name | Status |', '| --- | --- |', '| Suite | Ready |', '',
      '```js', 'const value = "<script>"', '```', '',
      '[Docs](https://example.com/docs)', '', '![Diagram](https://example.com/diagram.png)',
    ].join('\n'))
    expect(root.querySelector('h1')?.textContent).toBe('Project')
    expect(root.querySelector('strong')?.textContent).toBe('Ready')
    expect(root.querySelector('del')?.textContent).toBe('obsolete')
    expect(root.querySelector('blockquote')?.textContent).toContain('A quote')
    expect(root.querySelectorAll('ol li')).toHaveLength(2)
    expect(root.querySelector('td')?.textContent).toBe('Suite')
    const tasks = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect(tasks).toHaveLength(2)
    expect(tasks[0].checked).toBe(true)
    expect(tasks[1].checked).toBe(false)
    expect([...tasks].every((task) => task.disabled)).toBe(true)
    expect(root.querySelector('pre code')?.textContent).toContain('const value = "<script>"')
    expect(root.querySelector('a')?.href).toBe('https://example.com/docs')
    expect(root.querySelector('img')?.alt).toBe('Diagram')
  })

  it('removes executable HTML, event handlers, CSS and dangerous URLs', () => {
    const root = render([
      '<script>alert(1)</script>', '<iframe src="https://example.com"></iframe>',
      '<style>body { display: none }</style>',
      '<img src="x" onerror="alert(1)" style="position:fixed">',
      '<svg onload="alert(1)"></svg>', '',
      '[Click](javascript:alert%281%29)', '',
      '<a href="data:text/html,test" onclick="alert(1)">Unsafe</a>',
    ].join('\n'))
    expect(root.querySelector('script, iframe, style, svg')).toBeNull()
    expect(root.querySelector('[onerror], [onclick], [onload], [style]')).toBeNull()
    expect(root.querySelector('[href^="javascript:"], [href^="data:"]')).toBeNull()
  })

  it('supports empty files and a UTF-8 byte order mark', () => {
    expect(renderMarkdown('')).toBe('')
    expect(render('\uFEFF# Heading').querySelector('h1')?.textContent).toBe('Heading')
  })
})

describe('Markdown file detection', () => {
  it.each([
    { file_type: 'Markdown' }, { mime_type: 'text/markdown; charset=utf-8' },
    { mime_type: 'text/x-markdown' }, { file_name: 'README.MD', mime_type: 'text/plain' },
    { file_name: 'notes.markdown' },
  ])('recognises %j', (file) => expect(isMarkdownFile(file)).toBe(true))

  it.each([
    null, { file_name: 'notes.txt' }, { file_name: 'script.js' },
    { file_name: 'folder.md', is_folder: 1 },
    { file_name: 'Document.md', content_doctype: 'Writer Document' },
  ])('leaves other files alone: %j', (file) => expect(isMarkdownFile(file)).toBe(false))
})
