import { useState, type ReactNode } from 'react'

/**
 * Small dependency-free charts. Every chart has visible text labels, a hover/focus
 * tooltip per mark, and a "table" view so identity and values never rely on colour.
 */

export type Series = { id: string; label: string; color: string }

function ChartFrame({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string
  subtitle?: string
  legend?: Series[]
  table: { head: string[]; rows: (string | number)[][] }
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <div>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <button type="button" className="chart-toggle" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Chart' : 'Table'}
        </button>
      </figcaption>
      {legend && legend.length > 1 && !asTable && (
        <div className="legend chart-legend">
          {legend.map((item) => (
            <span key={item.id}><i style={{ background: item.color }} />{item.label}</span>
          ))}
        </div>
      )}
      {asTable ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>{table.head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>{row.map((cell, cellIndex) => (cellIndex === 0 ? <th key={cellIndex} scope="row">{cell}</th> : <td key={cellIndex}>{cell}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  )
}

/** Columns over time; each column can be a stack of series. */
export function ColumnChart({
  title,
  subtitle,
  series,
  columns,
  unit = '',
  reference,
}: {
  title: string
  subtitle?: string
  series: Series[]
  columns: { key: string; label: string; full: string; values: Record<string, number> }[]
  unit?: string
  /** Optional horizontal reference line on the same axis (e.g. a daily reference value). */
  reference?: { value: number; label: string }
}) {
  const [active, setActive] = useState<string | null>(null)
  const totals = columns.map((column) => series.reduce((sum, item) => sum + (column.values[item.id] ?? 0), 0))
  const max = Math.max(1, ...totals, reference?.value ?? 0)
  const fmt = (value: number) => `${Math.round(value * 10) / 10}${unit ? ` ${unit}` : ''}`
  const peak = totals.indexOf(Math.max(...totals))
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={series}
      table={{
        head: ['', ...(series.length > 1 ? series.map((item) => item.label) : []), 'Total'],
        rows: columns.map((column, index) => [
          column.full,
          ...(series.length > 1 ? series.map((item) => fmt(column.values[item.id] ?? 0)) : []),
          fmt(totals[index]),
        ]),
      }}
    >
      <div className="columns" style={{ ['--cols' as string]: columns.length }} onMouseLeave={() => setActive(null)}>
        {reference && (
          <div className="ref-line" style={{ bottom: `${(reference.value / max) * 100}%` }}>
            <span>{reference.label}</span>
          </div>
        )}
        {columns.map((column, index) => {
          const total = totals[index]
          return (
            <button
              key={column.key}
              type="button"
              className={`column ${active === column.key ? 'active' : ''}`}
              aria-label={`${column.full}: ${fmt(total)}`}
              onMouseEnter={() => setActive(column.key)}
              onFocus={() => setActive(column.key)}
              onBlur={() => setActive(null)}
            >
              <span className="column-plot">
                {(index === peak && total > 0) || active === column.key ? <span className="column-value">{fmt(total)}</span> : null}
                <span className="column-stack" style={{ height: `${(total / max) * 100}%` }}>
                  {series.map((item) => {
                    const value = column.values[item.id] ?? 0
                    if (!value) return null
                    return <i key={item.id} style={{ background: item.color, flexGrow: value }} />
                  })}
                </span>
              </span>
              <span className="column-label">{column.label}</span>
              {active === column.key && series.length > 1 && total > 0 && (
                <span className={`tooltip ${index >= columns.length / 2 ? 'end' : 'start'}`} role="tooltip">
                  <b>{column.full}</b>
                  {series.filter((item) => column.values[item.id]).map((item) => (
                    <span key={item.id}><i style={{ background: item.color }} />{item.label}: {fmt(column.values[item.id])}</span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </ChartFrame>
  )
}

/** Labelled horizontal bars — distributions and frequencies. */
export function BarList({
  title,
  subtitle,
  rows,
  unit = '',
}: {
  title: string
  subtitle?: string
  rows: { key: string; label: ReactNode; text: string; value: number; color: string; note?: string }[]
  unit?: string
}) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={{ head: ['', 'Count', 'Share'], rows: rows.map((row) => [row.text, row.value, total ? `${Math.round((row.value / total) * 100)}%` : '—']) }}
    >
      <div className="bar-list">
        {rows.map((row) => (
          <div key={row.key} className="bar-row" title={`${row.text}: ${row.value}${unit}`}>
            <span className="bar-label">{row.label}</span>
            <span className="bar-track">
              <i style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
            </span>
            <span className="bar-value">
              {row.value}
              {unit}
              {row.note && <small>{row.note}</small>}
            </span>
          </div>
        ))}
      </div>
    </ChartFrame>
  )
}

/** Days × categories presence grid (e.g. which food groups were eaten each day). */
export function PresenceGrid({
  title,
  subtitle,
  days,
  rows,
}: {
  title: string
  subtitle?: string
  days: { key: string; label: string; full: string; logged: boolean }[]
  rows: { key: string; label: string; color: string; present: Set<string> }[]
}) {
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={{
        head: ['', ...days.map((day) => day.label), 'Days'],
        rows: rows.map((row) => [row.label, ...days.map((day) => (!day.logged ? '–' : row.present.has(day.key) ? '✓' : '·')), `${row.present.size}/${days.filter((day) => day.logged).length}`]),
      }}
    >
      <div className="presence" style={{ ['--cols' as string]: days.length }}>
        <span />
        {days.map((day) => <span key={day.key} className="presence-day">{day.label}</span>)}
        <span />
        {rows.map((row) => (
          <div key={row.key} className="presence-row" role="row">
            <span className="presence-label">{row.label}</span>
            {days.map((day) => {
              const on = row.present.has(day.key)
              return (
                <span
                  key={day.key}
                  role="cell"
                  className={`presence-cell ${on ? 'on' : ''} ${day.logged ? '' : 'blank'}`}
                  style={on ? { background: row.color } : undefined}
                  title={`${row.label} · ${day.full}: ${!day.logged ? 'no meals logged' : on ? 'recorded' : 'not recorded'}`}
                  aria-label={`${row.label} ${day.full}: ${!day.logged ? 'no meals logged' : on ? 'recorded' : 'not recorded'}`}
                >
                  {on ? '✓' : ''}
                </span>
              )
            })}
            <span className="presence-count">{row.present.size}/{days.filter((day) => day.logged).length}</span>
          </div>
        ))}
      </div>
    </ChartFrame>
  )
}

/**
 * Measurements over age against reference curves (e.g. WHO percentile lines). One child series,
 * reference lines labelled directly at their right end; hover or focus a point for its values.
 */
export function GrowthChart({
  title,
  subtitle,
  unit,
  xDomain,
  curves,
  points,
  table,
}: {
  title: string
  subtitle?: string
  unit: string
  /** Age range in months. */
  xDomain: [number, number]
  curves: { label: string; emphasis?: boolean; points: [number, number][] }[]
  points: { key: string; x: number; y: number; full: string; detail: string }[]
  table: { head: string[]; rows: (string | number)[][] }
}) {
  const [active, setActive] = useState<string | null>(null)
  const W = 360
  const H = 220
  const pad = { l: 34, r: 34, t: 10, b: 26 }
  const ys = [...curves.flatMap((curve) => curve.points.map((point) => point[1])), ...points.map((point) => point.y)]
  const rawMin = Math.min(...ys)
  const rawMax = Math.max(...ys)
  const span = Math.max(rawMax - rawMin, 1)
  const step = niceStep(span / 4)
  const yMin = Math.floor((rawMin - span * 0.04) / step) * step
  const yMax = Math.ceil((rawMax + span * 0.04) / step) * step
  const [x0, x1] = xDomain
  const sx = (x: number) => pad.l + ((x - x0) / Math.max(x1 - x0, 1)) * (W - pad.l - pad.r)
  const sy = (y: number) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b)
  const yTicks: number[] = []
  for (let value = yMin; value <= yMax + 1e-9; value += step) yTicks.push(Math.round(value * 100) / 100)
  const monthStep = x1 - x0 > 30 ? 12 : x1 - x0 > 12 ? 6 : 3
  const xTicks: number[] = []
  for (let m = Math.ceil(x0 / monthStep) * monthStep; m <= x1; m += monthStep) xTicks.push(m)
  const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('')
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const current = sorted.find((point) => point.key === active)

  return (
    <ChartFrame title={title} subtitle={subtitle} table={table}>
      <div className="growth-chart" onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.length} measurement${points.length === 1 ? '' : 's'}`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="grid" x1={pad.l} x2={W - pad.r} y1={sy(tick)} y2={sy(tick)} />
              <text className="axis" x={pad.l - 5} y={sy(tick) + 3} textAnchor="end">{tick}</text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text key={tick} className="axis" x={sx(tick)} y={H - 8} textAnchor="middle">
              {tick % 12 === 0 ? `${tick / 12}y` : `${Math.floor(tick / 12)}y${tick % 12}m`}
            </text>
          ))}
          <line className="baseline" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
          {curves.map((curve) => {
            const last = curve.points[curve.points.length - 1]
            return (
              <g key={curve.label} className={`ref-curve ${curve.emphasis ? 'emphasis' : ''}`}>
                <path d={path(curve.points)} />
                <text x={sx(last[0]) + 4} y={sy(last[1]) + 3}>{curve.label}</text>
              </g>
            )
          })}
          {sorted.length > 1 && <path className="child-line" d={path(sorted.map((point) => [point.x, point.y]))} />}
          {sorted.map((point) => (
            <g
              key={point.key}
              tabIndex={0}
              role="button"
              aria-label={`${point.full}: ${point.detail}`}
              onMouseEnter={() => setActive(point.key)}
              onFocus={() => setActive(point.key)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(point.key)}
            >
              <circle className="hit" cx={sx(point.x)} cy={sy(point.y)} r={11} />
              <circle className={`child-dot ${active === point.key ? 'active' : ''}`} cx={sx(point.x)} cy={sy(point.y)} r={4} />
            </g>
          ))}
        </svg>
        <span className="growth-unit">{unit}</span>
        {current && (
          <span
            className={`tooltip ${sx(current.x) > W / 2 ? 'end' : 'start'}`}
            role="tooltip"
            style={{ left: sx(current.x) > W / 2 ? undefined : `${(sx(current.x) / W) * 100}%`, right: sx(current.x) > W / 2 ? `${100 - (sx(current.x) / W) * 100}%` : undefined, top: `calc(${(sy(current.y) / H) * 100}% - 8px)`, transform: 'translateY(-100%)' }}
          >
            <b>{current.full}</b>
            <span>{current.detail}</span>
          </span>
        )}
      </div>
    </ChartFrame>
  )
}

function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / power
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power
}
