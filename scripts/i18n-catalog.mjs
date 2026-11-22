import fs from 'node:fs'
import path from 'node:path'

const root = 'src'
const files = []
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'i18n') walk(p)
    } else if (/\.(vue|ts)$/.test(e.name)) {
      files.push(p)
    }
  }
}
walk(root)

const keys = new Set()
const callRe = /(?:\$t|\bt)\(\s*(['"])((?:\\.|(?!\1)[^\\])*[\u4e00-\u9fa5](?:\\.|(?!\1)[^\\])*)\1/g

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  let m
  while ((m = callRe.exec(src))) {
    keys.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'))
  }
}

// extra.ts 里手动登记的键
const extra = fs.readFileSync(path.join(root, 'i18n', 'extra.ts'), 'utf8')
const extraRe = /(['"])((?:\\.|(?!\1)[^\\])*[\u4e00-\u9fa5](?:\\.|(?!\1)[^\\])*)\1/g
let em
while ((em = extraRe.exec(extra))) {
  keys.add(em[2].replace(/\\'/g, "'"))
}

const list = [...keys].sort((a, b) => a.localeCompare(b, 'zh-CN'))
const out = `/** 由 scripts/i18n-catalog.mjs 生成；请勿手改。共 ${list.length} 条。 */
export const TEXT_CATALOG: string[] = ${JSON.stringify(list, null, 2)}
`
fs.writeFileSync(path.join(root, 'i18n', 'catalog.ts'), out, 'utf8')
console.log(`catalog: ${list.length} keys`)
