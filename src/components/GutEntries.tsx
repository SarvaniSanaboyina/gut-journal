import { stoolColorMeta } from '../constants'
import { formatTime } from '../dates'
import { bristolGroupMeta, bristolGroup, bristolMeta, formatDurationMinutes, formatGap, stamp, symptomIcon, symptomLabel } from '../gut'
import type { CareNotice } from '../safety'
import type { PoopEntry, SymptomEntry } from '../types'
import { StoolArt } from './Icons'

export function PoopRow({ entry, onSelect, showDate }: { entry: PoopEntry; onSelect?: () => void; showDate?: string }) {
  const meta = bristolMeta(entry.bristol)
  const group = bristolGroupMeta(bristolGroup(entry.bristol))
  const color = stoolColorMeta(entry.color)
  const body = (
    <>
      <StoolArt type={entry.bristol} />
      <span>
        <div className="title">
          Bristol type {entry.bristol} <span className="group-pill" style={{ background: `${group.color}22`, color: group.color }}>{group.label}</span>
        </div>
        <div className="detail">
          {meta.hint} · {color.label} · {entry.amount}
          {entry.notes ? ` · ${entry.notes}` : ''}
        </div>
        {(entry.straining || entry.pain || entry.mucus || entry.visibleBlood || entry.hasPhoto) && (
          <div className="flags">
            {entry.visibleBlood && <span className="flag urgent">Visible blood</span>}
            {entry.straining && <span className="flag">Straining</span>}
            {entry.pain && <span className="flag">Pain</span>}
            {entry.mucus && <span className="flag">Mucus</span>}
            {entry.hasPhoto && <span className="flag">Photo</span>}
          </div>
        )}
      </span>
      <span className="meta">{showDate ? `${showDate} · ` : ''}{formatTime(entry.time)}</span>
    </>
  )
  return onSelect ? (
    <button type="button" className="entry" onClick={onSelect}>{body}</button>
  ) : (
    <div className="entry">{body}</div>
  )
}

export function SymptomRow({ entry, onSelect, showDate }: { entry: SymptomEntry; onSelect?: () => void; showDate?: string }) {
  const onset = stamp(entry.date, entry.time)
  const body = (
    <>
      <span className="symptom-icon" aria-hidden="true">{symptomIcon(entry.type)}</span>
      <span>
        <div className="title">
          {symptomLabel(entry)} <span className={`severity-pill ${entry.severity}`}>{entry.severity}</span>
        </div>
        <div className="detail">
          {[entry.durationMinutes != null ? `Lasted ${formatDurationMinutes(entry.durationMinutes)}` : '', entry.notes].filter(Boolean).join(' · ')}
        </div>
        {entry.reactions.length > 0 && (
          <div className="flags">
            {entry.reactions.map((reaction) => (
              <span key={reaction.id} className="flag suspect">
                Suspected: {reaction.foodName} ({formatGap((onset - stamp(reaction.consumedDate, reaction.consumedTime)) / 60000)} before)
              </span>
            ))}
          </div>
        )}
      </span>
      <span className="meta">{showDate ? `${showDate} · ` : ''}{formatTime(entry.time)}</span>
    </>
  )
  return onSelect ? (
    <button type="button" className="entry" onClick={onSelect}>{body}</button>
  ) : (
    <div className="entry">{body}</div>
  )
}

export function CareNotices({ notices }: { notices: CareNotice[] }) {
  if (!notices.length) return null
  return (
    <div className="care-notices" role="status">
      {notices.map((notice) => (
        <div key={notice.id} className={`care-notice ${notice.level}`}>
          <strong>{notice.title}</strong>
          <p>{notice.body}</p>
        </div>
      ))}
    </div>
  )
}
