import { describe, expect, it } from 'vitest'
import { decodeBuffer, detectDelim, parseCSV } from '@/lib/csv'

describe('CSV 解析', () => {
  it('自动探测分隔符', () => {
    expect(detectDelim('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelim('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelim('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(detectDelim('a|b|c\n1|2|3')).toBe('|')
  })

  it('处理引号、逗号与转义引号', () => {
    const { headers, rows } = parseCSV('a,b\n"x,1","he said ""hi"""\n')
    expect(headers).toEqual(['a', 'b'])
    expect(rows).toEqual([['x,1', 'he said "hi"']])
  })

  it('处理 BOM、CRLF 与空行', () => {
    const { headers, rows } = parseCSV('\uFEFFname,age\r\n\r\nAlice,30\r\nBob,20\r\n')
    expect(headers).toEqual(['name', 'age'])
    expect(rows).toEqual([
      ['Alice', '30'],
      ['Bob', '20'],
    ])
  })

  it('去重列名并补齐短行', () => {
    const { headers, rows } = parseCSV('a,a\n1\n2,3')
    expect(headers).toEqual(['a', 'a_2'])
    expect(rows).toEqual([
      ['1', ''],
      ['2', '3'],
    ])
  })

  it('缺少数据行时报错', () => {
    expect(() => parseCSV('a,b')).toThrow()
  })
})

describe('编码探测', () => {
  it('UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62])
    expect(decodeBuffer(bytes.buffer)).toBe('a,b')
  })

  it('UTF-16 LE BOM', () => {
    const body = Buffer.from('姓名,年龄', 'utf16le')
    const bytes = new Uint8Array([0xff, 0xfe, ...body])
    expect(decodeBuffer(bytes.buffer)).toBe('姓名,年龄')
  })

  it('GB18030 回退', () => {
    // “你好” 的 GBK 编码
    const bytes = new Uint8Array([0xc4, 0xe3, 0xba, 0xc3])
    expect(decodeBuffer(bytes.buffer)).toBe('你好')
  })
})
