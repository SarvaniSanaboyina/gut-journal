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
