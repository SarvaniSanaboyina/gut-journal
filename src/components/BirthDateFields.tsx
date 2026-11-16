import { useRef, useState, type ReactNode } from 'react'
import type { BirthDateParts } from '../dates'

function DayMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="4.2" fill="#f4d36a" />
      <path
        d="M9 1.6v1.8M9 14.6v1.8M1.6 9h1.8M14.6 9h1.8M3.5 3.5l1.3 1.3M13.2 13.2l1.3 1.3M3.5 14.5l1.3-1.3M13.2 4.8l1.3-1.3"
        fill="none"
        stroke="#e0b13a"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MonthMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 15.2c3.4 0 6.2-2.5 6.2-6.1C12.8 10.4 10.7 8 9 5.4 7.3 8 5.2 10.4 2.8 9.1c0 3.6 2.8 6.1 6.2 6.1Z" fill="#8ec8f0" />
      <circle cx="12.4" cy="4.4" r="1.1" fill="#f4d36a" />
    </svg>
  )
}

function YearMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 1.8 10.4 6h4.4L11.5 8.7 12.9 13 9 10.4 5.1 13l1.4-4.3L3.2 6h4.4L9 1.8Z" fill="#cbb6eb" />
    </svg>
  )
}

function toDigits(value: BirthDateParts) {
  return `${value.day}${value.month}${value.year}`.replace(/\D/g, '').slice(0, 8)
}

function toParts(digits: string): BirthDateParts {
  return {
    day: digits.slice(0, 2),
    month: digits.slice(2, 4),
    year: digits.slice(4, 8),
  }
}

function Group({
  kind,
  label,
  mark,
  cells,
  start,
  active,
}: {
  kind: 'day' | 'month' | 'year'
  label: string
  mark: ReactNode
  cells: string[]
  start: number
  active: number | null
}) {
  return (
    <div className={`dob-group dob-group-${kind}`}>
      <span className="dob-group-label">
        {mark}
        {label}
      </span>
      <div className="dob-cells">
        {cells.map((digit, index) => {
          const slot = start + index
          return (
            <span key={slot} className={active === slot ? 'dob-cell is-active' : 'dob-cell'}>
              {digit}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function BirthDateFields({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label?: string
  value: BirthDateParts
  onChange: (next: BirthDateParts) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const digits = toDigits(value)
  const cells = Array.from({ length: 8 }, (_, index) => digits[index] ?? '')
  const active = focused && digits.length < 8 ? digits.length : null
  const fieldLabel = label ?? 'Date of birth'

  return (
    <div className="dob-otp" role="group" aria-label={fieldLabel}>
      {label ? (
        <p className="dob-legend" id={`${id}-label`}>
          {label}
        </p>
      ) : null}
      <div className="dob-otp-track" onClick={() => inputRef.current?.focus()}>
        <Group kind="day" label="Date" mark={<DayMark />} cells={cells.slice(0, 2)} start={0} active={active} />
        <span className="dob-sep" aria-hidden="true">/</span>
        <Group kind="month" label="Month" mark={<MonthMark />} cells={cells.slice(2, 4)} start={2} active={active} />
        <span className="dob-sep" aria-hidden="true">/</span>
        <Group kind="year" label="Year" mark={<YearMark />} cells={cells.slice(4, 8)} start={4} active={active} />
        <input
          id={id}
          ref={inputRef}
          className="dob-otp-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          name="dob-digits"
          value={digits}
          maxLength={8}
          aria-label={fieldLabel}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => onChange(toParts(event.target.value.replace(/\D/g, '').slice(0, 8)))}
          required
        />
      </div>
    </div>
  )
}
