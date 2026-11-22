<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDatasetStore } from '@/stores/dataset'
import SelectField from '@/components/SelectField.vue'
import { pickTarget } from '@/lib/infer'
import { fmtInt, isNull } from '@/lib/format'
import { copyText } from '@/lib/exportChart'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/composables/useToast'
import { t } from '@/i18n'

interface InsItem {
  key?: string
  strong?: string
  text?: string
  value?: string
  cls?: string
  tag?: string
  meta?: string
  bar?: number
  barColor?: string
}

interface InsCard {
  title: string
  items: InsItem[]
  note?: string
}

const ds = useDatasetStore()
const settings = useSettingsStore()
const targetName = ref(pickTarget(ds.targets))

onMounted(() => {
  void ds.ensurePairs('pearson')
})

const pairs = computed(() => ds.cachedPairs('pearson'))
const target = computed(() => ds.column(targetName.value))

const completeRows = computed(() => {
  const d = ds.dataset
  if (!d) return 0
  return d.rows.filter((r) => r.every((v) => !isNull(v))).length
})

const dupCount = computed(() => {
  const d = ds.dataset
  if (!d) return 0
  const seen = new Set<string>()
  let dup = 0
  for (const r of d.rows) {
    const k = r.join('\u0001')
    if (seen.has(k)) dup++
    else seen.add(k)
  }
  return dup
})

const cards = computed<InsCard[]>(() => {
  const d = ds.dataset
  if (!d) return []
  const out: InsCard[] = []
  const miss = d.columns.reduce((s, c) => s + c.missing, 0)
  const cells = d.n * d.columns.length

  out.push({
    title: t('📦 数据概况'),
    items: [
      {
        strong: t('规模：'),
        text: t('{rows} 行 × {cols} 列', { rows: fmtInt(d.n), cols: d.columns.length }),
      },
      {
        strong: t('类型：'),
        text: t('数值 {num} · 类别 {cat} · 日期 {date}', {
          num: ds.nums.length,
          cat: ds.cats.length,
          date: ds.dates.length,
        }),
      },
      {
        strong: t('缺失：'),
        text: t('{n} 个单元格（{p}%）', {
          n: fmtInt(miss),
          p: cells ? ((miss / cells) * 100).toFixed(2) : 0,
        }),
      },
      {
        strong: t('完整行：'),
        text: t('{n}（{p}%）', {
          n: fmtInt(completeRows.value),
          p: d.n ? ((completeRows.value / d.n) * 100).toFixed(1) : 0,
        }),
      },
    ],
  })

  const top5 = pairs.value.slice(0, 5)
  out.push({
    title: t('🔗 最强关联（所有变量对）'),
    items: top5.map((p) => ({
      key: p.a + '|' + p.b,
      strong: `${settings.columnLabel(p.a)} ↔ ${settings.columnLabel(p.b)}`,
      text: '：',
      value: p.strength.toFixed(2),
      cls: p.signed === null ? '' : p.signed >= 0 ? 'pos' : 'neg',
      tag: p.type,
      meta: ` n=${fmtInt(p.n)}`,
    })),
    note: top5.length ? t('r / ρ 为有符号相关，V / η 只反映强度。') : undefined,
  })

  if (target.value) {
    const list = ds.assocWithTarget(target.value, 'pearson').slice(0, 6)
    const maxS = Math.max(...list.map((x) => x.strength), 1e-9)
    out.push({
      title: t('🎯 与「{name}」的关联', { name: settings.columnLabel(target.value.name) }),
      items: list.map((x) => ({
        key: x.name,
        bar: Math.max(6, (x.strength / maxS) * 50),
        barColor: settings.assocColor(x.signed),
        strong: settings.columnLabel(x.name),
        text: '：' + x.strength.toFixed(2),
        tag: x.type,
        meta:
          ' ' +
          (x.strength >= 0.6 ? t('强') : x.strength >= 0.3 ? t('中等') : t('弱')),
      })),
      note: t(
        "目标类型：{type}。数值×数值用 r，数值×类别用 η，类别×类别用 Cramér's V。",
        {
          type: target.value.type === 'number' ? t('数值') : t('类别'),
        },
      ),
    })
  }

  const catPairs = pairs.value.filter((p) => p.type === 'V' || p.type === 'η').slice(0, 5)
  if (catPairs.length) {
    out.push({
      title: t('🧩 类别维度关联（V / η）'),
      items: catPairs.map((p) => ({
        key: p.a + '|' + p.b,
        strong: `${settings.columnLabel(p.a)} ↔ ${settings.columnLabel(p.b)}`,
        text: '：' + p.strength.toFixed(2),
        tag: p.type,
      })),
      note: t('V / η 没有正负方向，数值越大关联越强。'),
    })
  }

  const redundant = pairs.value
    .filter((p) => (p.type === 'r' || p.type === 'ρ') && p.strength >= 0.8)
    .slice(0, 6)
  out.push({
    title: t('♻️ 高度相关（可能冗余）'),
    items: redundant.length
      ? redundant.map((p) => ({
          key: p.a + '|' + p.b,
          strong: `${settings.columnLabel(p.a)} ↔ ${settings.columnLabel(p.b)}`,
          text: '：',
          value: `r = ${(p.signed ?? 0).toFixed(2)}`,
          cls: (p.signed ?? 0) >= 0 ? 'pos' : 'neg',
        }))
      : [{ text: t('未发现 |r| ≥ 0.8 的强相关变量对。') }],
    note: redundant.length
      ? t('这些变量表达的信息高度重叠，建模时可考虑保留其一。')
      : undefined,
  })

  const missCols = d.columns
    .filter((c) => c.missing > 0)
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 4)
  const consts = d.columns.filter((c) => c.uniqueCount <= 1)

  out.push({
    title: t('🧪 数据质量检查'),
    items: [
      {
        text: missCols.length
          ? t('缺失最多：{list}', {
              list: missCols
                .map(
                  (c) =>
                    `${settings.columnLabel(c.name)} ${((c.missing / d.n) * 100).toFixed(1)}%`,
                )
                .join(' · '),
            })
          : t('没有缺失值 👍'),
      },
      {
        text: t('常量列：{list}', {
          list: consts.length
            ? consts.map((c) => settings.columnLabel(c.name)).join('、')
            : t('0 个'),
        }),
      },
      {
        text: t('重复行：{n} 行（{p}%）', {
          n: fmtInt(dupCount.value),
          p: d.n ? ((dupCount.value / d.n) * 100).toFixed(1) : 0,
        }),
      },
      { text: t('参与关联分析的变量：{n} 个', { n: ds.assocs.length }) },
    ],
  })

  return out
})

function insightsText(): string {
  return cards.value
    .map((c) => {
      const lines = c.items.map((it) => {
        const parts = [it.strong, it.text, it.value, it.tag ? `[${it.tag}]` : '', it.meta]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        return '· ' + parts
      })
      return `${c.title}\n${lines.join('\n')}${c.note ? '\n' + c.note : ''}`
    })
    .join('\n\n')
}

async function copyInsights(): Promise<void> {
  const ok = await copyText(insightsText())
  toast(ok ? t('分析结论已复制') : t('复制失败，请重试'))
}
</script>

<template>
  <section class="panel">
    <div class="controls">
      <SelectField
        v-model="targetName"
        :label="$t('分析目标')"
        :options="ds.targets.map((c) => ({ value: c.name, label: settings.columnLabel(c.name) }))"
      />
      <button class="btn" type="button" @click="copyInsights">{{ $t('复制结论') }}</button>
      <span class="hint">{{ $t('自动汇总最强关联、目标因素、类别关联与数据质量') }}</span>
    </div>

    <div class="insights">
      <div v-for="c in cards" :key="c.title" class="ins-card">
        <h4>{{ c.title }}</h4>
        <ul>
          <li v-for="(it, i) in c.items" :key="it.key ?? i">
            <span
              v-if="it.bar"
              class="bar"
              :style="{ width: it.bar + 'px', background: it.barColor }"
            ></span>
            <b v-if="it.strong">{{ it.strong }}</b>
            <span v-if="it.text">{{ it.text }}</span>
            <span v-if="it.value" :class="it.cls">{{ it.value }}</span>
            <span v-if="it.tag" class="sumtag">{{ it.tag }}</span>
            <span v-if="it.meta" class="hint">{{ it.meta }}</span>
          </li>
        </ul>
        <div v-if="c.note" class="hint" style="margin-top: 8px">{{ c.note }}</div>
      </div>
    </div>
  </section>
</template>
