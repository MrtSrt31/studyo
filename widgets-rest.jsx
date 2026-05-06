/* global React, Icon, useT, fmtMinsHrs, DEMO_WEEK, DEMO_CLASSES, makeHeatmap */
const { useState, useEffect, useRef, useMemo } = React;

/* ============================================================
   STREAK widget
   ============================================================ */
function StreakWidget({ streak, days7 }) {
  const { t } = useT();
  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="sd-flame">
          <Icon name="flame" size={20} stroke={2.4} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="sd-eyebrow">{t.streak}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="tabular" style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>{streak}</span>
            <span style={{ color: 'var(--fg3)', fontWeight: 700, fontSize: 13 }}>{t.streakDays}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days7.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div className="sd-eyebrow" style={{ fontSize: 9 }}>{t.weekdays[i]}</div>
            <div style={{
              width: '100%', aspectRatio: '1',
              borderRadius: 8,
              background: d > 0 ? `linear-gradient(135deg, color-mix(in oklch, var(--primary) ${30 + d * 18}%, transparent), var(--primary))` : 'var(--fill-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: d > 0 ? '#fff' : 'var(--fg-muted)',
              fontSize: 11, fontWeight: 800,
              boxShadow: d > 2 ? 'var(--shadow-amber)' : 'none',
              opacity: d > 0 ? 1 : 0.6,
            }}>
              {d > 0 && <Icon name="check" size={10} stroke={3} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   WEEKLY BAR CHART
   ============================================================ */
function WeeklyChart({ data }) {
  const { t } = useT();
  const max = Math.max(...data, 60);
  const totalH = data.reduce((s, x) => s + x, 0) / 60;
  const avgH = totalH / 7;

  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="sd-eyebrow">{t.weeklyFocus}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span className="tabular" style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1.2 }}>{totalH.toFixed(1)}</span>
            <span style={{ color: 'var(--fg3)', fontSize: 13, fontWeight: 700 }}>{t.hrsTotal}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="sd-eyebrow">{t.avgPerDay}</div>
          <div className="tabular" style={{ fontWeight: 800, fontSize: 16, marginTop: 4 }}>{avgH.toFixed(1)}{t.hours}</div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8,
        height: 140, alignItems: 'end', padding: '0 4px'
      }}>
        {data.map((v, i) => {
          const isToday = i === new Date().getDay() === 0 ? 6 : (new Date().getDay() - 1);
          const h = (v / max) * 100;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div className="tabular" style={{ fontSize: 10, color: 'var(--fg3)', fontWeight: 700 }}>{Math.round(v / 60 * 10) / 10}{t.hours}</div>
              <div style={{
                width: '100%', height: `${h}%`,
                minHeight: 6,
                borderRadius: 8,
                background: isToday
                  ? 'linear-gradient(180deg, #FFB97A, var(--primary))'
                  : 'linear-gradient(180deg, var(--fill), var(--fill-2))',
                boxShadow: isToday ? 'var(--shadow-amber)' : 'none',
                transition: 'height 0.4s ease'
              }} />
              <div className="sd-eyebrow" style={{ fontSize: 9 }}>{t.weekdays[i]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   HEATMAP — GitHub-style activity grid
   ============================================================ */
function HeatmapWidget({ cells }) {
  const { t } = useT();
  const cols = 13;
  const rows = 7;
  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="sd-eyebrow">{t.contributions}</div>
          <div className="sd-h3" style={{ marginTop: 4 }}>13 {t.weekdays ? "hafta" : "weeks"}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="sd-meta">az</span>
          {[0,1,2,3,4].map(v => (
            <div key={v} style={{
              width: 12, height: 12, borderRadius: 3,
              background: heatColor(v),
            }} />
          ))}
          <span className="sd-meta">çok</span>
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoFlow: 'column',
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 4,
        aspectRatio: `${cols} / ${rows}`
      }}>
        {cells.map((v, i) => (
          <div key={i} style={{
            background: heatColor(v),
            borderRadius: 3,
            transition: 'transform 0.15s',
            cursor: 'pointer'
          }} title={`${v} oturum`} />
        ))}
      </div>
    </div>
  );
}
function heatColor(v) {
  if (v === 0) return 'var(--fill-2)';
  const op = [0, 0.25, 0.5, 0.75, 1][v];
  return `color-mix(in oklch, var(--primary) ${op * 100}%, var(--fill-2))`;
}

/* ============================================================
   SCHEDULE — today's classes
   ============================================================ */
function ScheduleWidget({ classes, now }) {
  const { t } = useT();
  const nowM = now.getHours() * 60 + now.getMinutes();

  function status(c) {
    const [sh, sm] = c.start.split(":").map(Number);
    const [eh, em] = c.end.split(":").map(Number);
    const sM = sh * 60 + sm, eM = eh * 60 + em;
    if (nowM >= sM && nowM < eM) return "now";
    if (nowM >= eM) return "over";
    return "upcoming";
  }

  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="sd-eyebrow">{t.schedule}</div>
          <div className="sd-h3" style={{ marginTop: 4 }}>
            {classes.length} <span style={{ color: 'var(--fg3)', fontWeight: 600, fontSize: 14 }}>ders</span>
          </div>
        </div>
        <button className="sd-btn sd-btn--ghost" style={{ padding: '6px 10px', fontSize: 12 }}>
          <Icon name="calendar" size={14} /> Takvim
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {classes.map(c => {
          const st = status(c);
          const colorVar = `var(--${c.color === "amber" ? "primary" : c.color})`;
          const lightVar = c.color === "amber" ? "var(--primary-light)" : `var(--${c.color}-light)`;
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px',
              borderRadius: 14,
              background: st === "now" ? lightVar : 'transparent',
              border: st === "now" ? `1px solid ${colorVar}` : '1px solid transparent',
              opacity: st === "over" ? 0.5 : 1,
              transition: 'all 0.15s'
            }}>
              <div style={{
                width: 4, alignSelf: 'stretch',
                borderRadius: 99,
                background: colorVar,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg1)', letterSpacing: '-0.2px', textDecoration: st === "over" ? 'line-through' : 'none' }}>
                  {c.title}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 11, color: 'var(--fg3)', fontWeight: 600 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0.4 }}>{c.course}</span>
                  <span>·</span>
                  <span>{c.room}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tabular" style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg1)' }}>{c.start}</div>
                <div className="sd-meta" style={{ fontSize: 10 }}>{c.end}</div>
              </div>
              {st === "now" && (
                <span className="sd-pill sd-pill--amber" style={{ fontSize: 10 }}>
                  <span className="sd-dot sd-pulsing" /> {t.classNow}
                </span>
              )}
              {st === "over" && <Icon name="check" size={14} style={{ color: 'var(--success)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   NOTES widget
   ============================================================ */
function NotesWidget({ value, setValue }) {
  const { t } = useT();
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="sd-eyebrow">{t.notes}</div>
          <div className="sd-h3" style={{ marginTop: 4 }}>
            <span className="tabular">{wordCount}</span> <span style={{ color: 'var(--fg3)', fontWeight: 600, fontSize: 14 }}>kelime</span>
          </div>
        </div>
        <Icon name="notebook-pen" size={20} style={{ color: 'var(--fg3)' }} />
      </div>
      <textarea
        placeholder={t.notesHint}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: '100%', minHeight: 130,
          background: 'var(--fill-3)',
          border: '1px solid transparent',
          borderRadius: 14,
          padding: 14,
          fontSize: 14, lineHeight: 1.55,
          color: 'var(--fg1)',
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit'
        }}
      />
    </div>
  );
}

/* ============================================================
   MUSIC widget — Spotify + Ambient tabs
   ============================================================ */
function MusicWidget() {
  const { t } = useT();
  const [tab, setTab] = useState("spotify");
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(72);
  const [active, setActive] = useState({ rain: 60, cafe: 0, forest: 0, fire: 0, waves: 0, keyboard: 0 });

  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="sd-eyebrow">{t.musicTitle}</div>
          <div className="sd-h3" style={{ marginTop: 4 }}>{tab === "spotify" ? t.spotify : t.ambient}</div>
        </div>
        <div className="sd-seg">
          <button className={`sd-seg__btn ${tab === "spotify" ? "sd-seg__btn--on" : ""}`} onClick={() => setTab("spotify")}>{t.spotify}</button>
          <button className={`sd-seg__btn ${tab === "ambient" ? "sd-seg__btn--on" : ""}`} onClick={() => setTab("ambient")}>{t.ambient}</button>
        </div>
      </div>

      {tab === "spotify" ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 14,
              background: 'linear-gradient(135deg, #C5631A, #E8843C 50%, #FFB97A)',
              boxShadow: 'var(--shadow-amber)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff'
            }}>
              <Icon name="music" size={26} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.2px' }}>Deep Focus — Lofi Mix</div>
              <div className="sd-meta" style={{ marginTop: 2 }}>Coffee Shop Sessions · 1h 24m</div>
            </div>
          </div>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sd-meta tabular">1:24</span>
            <div style={{ flex: 1, height: 4, background: 'var(--fill-2)', borderRadius: 99, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, width: '32%', background: 'var(--primary)', borderRadius: 99 }} />
              <div style={{ position: 'absolute', left: '32%', top: -3, width: 10, height: 10, borderRadius: 99, background: 'var(--primary)', boxShadow: 'var(--shadow-amber)' }} />
            </div>
            <span className="sd-meta tabular">3:42</span>
          </div>
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <button className="sd-btn sd-btn--ghost sd-btn--icon"><Icon name="shuffle" size={16} /></button>
            <button className="sd-btn sd-btn--ghost sd-btn--icon"><Icon name="skip-back" size={16} /></button>
            <button className="sd-btn sd-btn--primary" style={{ width: 48, height: 48, borderRadius: 99, padding: 0 }} onClick={() => setPlaying(p => !p)}>
              <Icon name={playing ? "pause" : "play"} size={18} />
            </button>
            <button className="sd-btn sd-btn--ghost sd-btn--icon"><Icon name="skip-forward" size={16} /></button>
            <button className="sd-btn sd-btn--ghost sd-btn--icon"><Icon name="repeat" size={16} /></button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { key: "rain", icon: "cloud-rain", label: t.rain },
            { key: "cafe", icon: "coffee", label: t.cafe },
            { key: "forest", icon: "trees", label: t.forest },
            { key: "fire", icon: "flame", label: t.fire },
            { key: "waves", icon: "waves", label: t.waves },
            { key: "keyboard", icon: "keyboard", label: t.keyboard },
          ].map(s => (
            <button key={s.key}
              onClick={() => setActive(a => ({ ...a, [s.key]: a[s.key] > 0 ? 0 : 60 }))}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px 6px',
                borderRadius: 14,
                border: active[s.key] > 0 ? '1.4px solid var(--primary)' : '1.4px solid var(--separator)',
                background: active[s.key] > 0 ? 'var(--primary-light)' : 'var(--fill-3)',
                color: active[s.key] > 0 ? 'var(--primary-deep)' : 'var(--fg2)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              <Icon name={s.icon} size={20} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>{s.label}</span>
              <div style={{ width: '100%', height: 3, background: 'var(--fill-2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${active[s.key]}%`, height: '100%', background: 'currentColor' }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STAT TILES (for stats row)
   ============================================================ */
function StatTile({ icon, label, value, sub, accent }) {
  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="sd-eyebrow">{label}</div>
        <div style={{
          width: 28, height: 28, borderRadius: 9,
          background: accent ? 'var(--primary-light)' : 'var(--fill-2)',
          color: accent ? 'var(--primary-deep)' : 'var(--fg2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon name={icon} size={14} />
        </div>
      </div>
      <div className="tabular" style={{ fontSize: 26, fontWeight: 900, letterSpacing: -1, lineHeight: 1, color: 'var(--fg1)' }}>{value}</div>
      {sub && <div className="sd-meta" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, { StreakWidget, WeeklyChart, HeatmapWidget, ScheduleWidget, NotesWidget, MusicWidget, StatTile });
