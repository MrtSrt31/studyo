/* global React, Icon, useT, fmtClock, useInterval, useLocal,
   DEMO_TASKS, DEMO_CLASSES, DEMO_WEEK, makeHeatmap,
   TimerWidget, TasksWidget, StreakWidget, WeeklyChart, HeatmapWidget,
   ScheduleWidget, NotesWidget, MusicWidget, StatTile, STRINGS, I18nContext */

const { useState, useEffect, useRef, useMemo } = React;

/* ============================================================
   DESKTOP SHELL
   ============================================================ */
function DesktopApp({ tweaks, setTweak }) {
  const lang = tweaks.lang;
  const t = STRINGS[lang];
  const [tasks, setTasks] = useState(DEMO_TASKS);
  const [notes, setNotes] = useState(
    "• Cengiz hocaya algoritma sorusunu sor\n• Yarın 10:00'da çalışma grubu — kütüphane 2. kat\n• Calculus midterm haftaya — Bölüm 11 + 12 bitir"
  );
  const [now, setNow] = useState(new Date());
  useInterval(() => setNow(new Date()), 1000);

  const [days7] = useState([1, 2, 2, 3, 3, 1, 0]); // streak history (today partial)
  const heatmap = useMemo(() => makeHeatmap(), []);
  const motiv = t.motivational[2];
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (lang === "tr") return h < 6 ? "İyi geceler" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
    return h < 6 ? "Late night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, [now, lang]);

  const visible = tweaks.widgets;

  return (
    <I18nContext.Provider value={{ t, lang, setLang: l => setTweak('lang', l) }}>
    <div className="sd-stage" data-density={tweaks.density} style={{ minHeight: 920 }}>
      {/* Orbs */}
      <div className="sd-orbs">
        <div className="sd-orb" style={{ width: 520, height: 520, top: -160, right: -120, background: 'var(--orb-1)' }} />
        <div className="sd-orb" style={{ width: 460, height: 460, bottom: -120, left: -100, background: 'var(--orb-2)' }} />
        <div className="sd-orb" style={{ width: 360, height: 360, top: 280, left: '40%', background: 'var(--orb-3)' }} />
      </div>

      {/* Sidebar + content */}
      <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 920 }}>
        <DesktopSidebar tweaks={tweaks} setTweak={setTweak} />
        <main style={{ padding: '24px 32px 36px', display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
          {/* Header */}
          <DesktopHeader greeting={greeting} now={now} h12={tweaks.h12} setTweak={setTweak} tweaks={tweaks} motiv={motiv} />

          {/* Stats row */}
          {visible.stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <StatTile icon="clock-3" label={t.today} value="2h 25m" sub="hedef 4h" accent />
              <StatTile icon="zap" label={t.sessionsToday} value="5" sub={`pomodoro · 25dk`} />
              <StatTile icon="check-check" label={t.completionRate} value="68%" sub="bu hafta" />
              <StatTile icon="trophy" label={t.bestDay} value="Çar" sub="3h 50m odak" />
            </div>
          )}

          {/* Main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr) minmax(0, 0.95fr)', gap: 16, alignItems: 'start' }}>
            {/* Column A — timer + streak + music */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {visible.timer && <TimerWidget density={tweaks.density} h12={tweaks.h12} />}
              {visible.streak && <StreakWidget streak={12} days7={days7} />}
              {visible.music && <MusicWidget />}
            </div>
            {/* Column B — tasks + notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {visible.tasks && <TasksWidget tasks={tasks} setTasks={setTasks} />}
              {visible.notes && <NotesWidget value={notes} setValue={setNotes} />}
            </div>
            {/* Column C — schedule + chart + heatmap */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {visible.schedule && <ScheduleWidget classes={DEMO_CLASSES} now={now} />}
              {visible.chart && <WeeklyChart data={DEMO_WEEK} />}
              {visible.heatmap && <HeatmapWidget cells={heatmap} />}
            </div>
          </div>
        </main>
      </div>
    </div>
    </I18nContext.Provider>
  );
}

function DesktopSidebar({ tweaks, setTweak }) {
  const { t } = useT();
  const [active, setActive] = useState("home");
  const lang = tweaks.lang;
  const items = [
    { key: "home", icon: "house", label: t.home },
    { key: "timer", icon: "timer", label: t.timer },
    { key: "tasks", icon: "list-checks", label: t.tasks },
    { key: "stats", icon: "chart-line", label: t.stats },
    { key: "library", icon: "library", label: t.library },
  ];
  return (
    <aside style={{
      padding: '24px 16px 24px',
      display: 'flex', flexDirection: 'column', gap: 24,
      borderRight: '1px solid var(--separator)',
      background: 'var(--header-bg)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
        <div className="sd-logo-mark">
          <Icon name="book-open" size={18} stroke={2.4} />
        </div>
        <span className="sd-wordmark">stud<em>y</em>o</span>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="sd-eyebrow" style={{ padding: '0 10px 6px' }}>menü</div>
        {items.map(it => (
          <button key={it.key}
            onClick={() => setActive(it.key)}
            className="sd-btn"
            style={{
              justifyContent: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              fontSize: 14, fontWeight: 700,
              background: active === it.key ? 'var(--primary)' : 'transparent',
              color: active === it.key ? '#fff' : 'var(--fg2)',
              boxShadow: active === it.key ? 'var(--shadow-amber)' : 'none',
            }}>
            <Icon name={it.icon} size={16} stroke={active === it.key ? 2.4 : 2.2} />
            {it.label}
          </button>
        ))}
      </nav>

      {/* Today goal */}
      <div className="sd-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="sd-eyebrow">{t.focusToday}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span className="tabular" style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>2.4</span>
          <span style={{ color: 'var(--fg3)', fontWeight: 700, fontSize: 12 }}>/ 4h</span>
        </div>
        <div style={{ height: 6, background: 'var(--fill-2)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #FFB97A, var(--primary))', borderRadius: 99 }} />
        </div>
        <div className="sd-meta" style={{ fontSize: 11 }}>%60 — devam et</div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderTop: '1px solid var(--separator)', paddingTop: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 11,
          background: 'linear-gradient(135deg, #B8AB94, #4A3F2E)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, letterSpacing: 0.2
        }}>EY</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.2px' }}>Elif Yıldız</div>
          <div className="sd-meta" style={{ fontSize: 11 }}>2. sınıf · CENG</div>
        </div>
        <button className="sd-btn" style={{ padding: 6, background: 'transparent' }}>
          <Icon name="settings" size={14} />
        </button>
      </div>
    </aside>
  );
}

function DesktopHeader({ greeting, now, h12, setTweak, tweaks, motiv }) {
  const { t, lang } = useT();
  const dateStr = `${now.getDate()} ${t.months[now.getMonth()]} ${t.weekdays[(now.getDay() + 6) % 7]}`;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
      <div>
        <div className="sd-eyebrow" style={{ marginBottom: 6 }}>{dateStr} · {fmtClock(now, h12)}</div>
        <h1 className="sd-h1" style={{ fontSize: 34 }}>
          {greeting}, <span style={{ color: 'var(--primary-deep)' }}>Elif</span>.
        </h1>
        <div className="sd-body" style={{ marginTop: 6, fontSize: 14, color: 'var(--fg2)' }}>{motiv}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="sd-btn sd-btn--ghost" onClick={() => setTweak('lang', lang === 'tr' ? 'en' : 'tr')}>
          <Icon name="languages" size={14} /> {lang.toUpperCase()}
        </button>
        <button className="sd-btn sd-btn--ghost" onClick={() => setTweak('theme', tweaks.theme === 'dark' ? 'light' : 'dark')}>
          <Icon name={tweaks.theme === 'dark' ? 'sun' : 'moon'} size={14} />
        </button>
        <div className="sd-input" style={{ padding: '6px 10px', background: 'var(--surface-elevated)', maxWidth: 220 }}>
          <Icon name="search" size={14} style={{ color: 'var(--fg3)' }} />
          <input placeholder={lang === 'tr' ? 'Ara...' : 'Search...'} style={{ fontSize: 13 }} />
          <span className="sd-meta" style={{ fontSize: 10, padding: '2px 5px', borderRadius: 5, background: 'var(--fill-2)' }}>⌘K</span>
        </div>
        <button className="sd-btn sd-btn--primary">
          <Icon name="plus" size={14} /> {lang === 'tr' ? 'Hızlı seans' : 'Quick session'}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { DesktopApp, DesktopSidebar, DesktopHeader });
