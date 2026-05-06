/* global React, Icon, useT, fmtClock, useInterval, STRINGS, I18nContext,
   DEMO_TASKS, DEMO_CLASSES, DEMO_WEEK, makeHeatmap,
   TimerWidget, TasksWidget, StreakWidget, WeeklyChart, HeatmapWidget,
   ScheduleWidget, NotesWidget, MusicWidget, StatTile */

const { useState, useEffect, useMemo } = React;

/* ============================================================
   MOBILE APP — single phone with tab bar
   ============================================================ */
function MobileApp({ tweaks, setTweak }) {
  const lang = tweaks.lang;
  const t = STRINGS[lang];
  const [tab, setTab] = useState("home");
  const [tasks, setTasks] = useState(DEMO_TASKS);
  const [notes, setNotes] = useState("• Algoritma quiz çalış\n• Yarın çalışma grubu — kütüphane");
  const [now, setNow] = useState(new Date());
  useInterval(() => setNow(new Date()), 1000);
  const heatmap = useMemo(() => makeHeatmap(), []);
  const days7 = [1, 2, 2, 3, 3, 1, 0];

  return (
    <I18nContext.Provider value={{ t, lang, setLang: l => setTweak('lang', l) }}>
    <div className="sd-stage" data-density="compact" style={{ height: '100%', borderRadius: 0 }}>
      {/* Orbs */}
      <div className="sd-orbs">
        <div className="sd-orb" style={{ width: 280, height: 280, top: -90, right: -60, background: 'var(--orb-1)' }} />
        <div className="sd-orb" style={{ width: 240, height: 240, bottom: 60, left: -60, background: 'var(--orb-2)' }} />
      </div>

      {/* Body */}
      <div style={{ position: 'relative', zIndex: 2, height: '100%', overflow: 'auto', paddingBottom: 100 }} className="sd-scroll">
        {tab === "home" && <MobileHome tweaks={tweaks} setTweak={setTweak} now={now} tasks={tasks} setTasks={setTasks} days7={days7} />}
        {tab === "timer" && <MobileTimer tweaks={tweaks} />}
        {tab === "tasks" && <MobileTasks tasks={tasks} setTasks={setTasks} />}
        {tab === "stats" && <MobileStats data={DEMO_WEEK} cells={heatmap} />}
      </div>

      {/* Floating Tab Bar */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, right: 16,
        background: 'var(--tab-bg)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid var(--glass-border)',
        borderRadius: 24,
        padding: 8,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
        boxShadow: 'var(--shadow-xl)',
        zIndex: 10
      }}>
        {[
          { key: "home", icon: "house", label: t.home },
          { key: "timer", icon: "timer", label: t.timer },
          { key: "tasks", icon: "list-checks", label: t.tasks },
          { key: "stats", icon: "chart-line", label: t.stats },
        ].map(it => (
          <button key={it.key} onClick={() => setTab(it.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 4px',
              border: 'none', background: tab === it.key ? 'var(--primary)' : 'transparent',
              color: tab === it.key ? '#fff' : 'var(--fg2)',
              borderRadius: 16, cursor: 'pointer',
              boxShadow: tab === it.key ? 'var(--shadow-amber)' : 'none',
              transition: 'all 0.15s'
            }}>
            <Icon name={it.icon} size={18} stroke={tab === it.key ? 2.4 : 2.2} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.2 }}>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
    </I18nContext.Provider>
  );
}

function MobileHome({ tweaks, setTweak, now, tasks, setTasks, days7 }) {
  const { t, lang } = useT();
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (lang === "tr") return h < 6 ? "İyi geceler" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
    return h < 6 ? "Late night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, [now, lang]);
  const dateStr = `${now.getDate()} ${t.months[now.getMonth()]} · ${t.weekdays[(now.getDay() + 6) % 7]}`;
  return (
    <div style={{ padding: '60px 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sd-logo-mark" style={{ width: 32, height: 32, borderRadius: 10 }}>
            <Icon name="book-open" size={16} stroke={2.4} />
          </div>
          <span className="sd-wordmark" style={{ fontSize: 17 }}>stud<em>y</em>o</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="sd-btn sd-btn--ghost sd-btn--icon" onClick={() => setTweak('lang', lang === 'tr' ? 'en' : 'tr')} style={{ width: 34, height: 34, padding: 0, fontSize: 11, fontWeight: 800 }}>
            {lang.toUpperCase()}
          </button>
          <button className="sd-btn sd-btn--ghost sd-btn--icon" onClick={() => setTweak('theme', tweaks.theme === 'dark' ? 'light' : 'dark')} style={{ width: 34, height: 34, padding: 0 }}>
            <Icon name={tweaks.theme === 'dark' ? 'sun' : 'moon'} size={14} />
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div>
        <div className="sd-eyebrow" style={{ marginBottom: 4 }}>{dateStr}</div>
        <h1 className="sd-h2" style={{ fontSize: 24, lineHeight: 1.15 }}>
          {greeting},<br/><span style={{ color: 'var(--primary-deep)' }}>Elif</span>.
        </h1>
      </div>

      {/* Today goal banner */}
      <div className="sd-card sd-card-pad" style={{
        padding: 16, display: 'flex', alignItems: 'center', gap: 14,
        background: 'linear-gradient(135deg, color-mix(in oklch, var(--primary-light) 80%, transparent), var(--card))'
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #FFB97A, var(--primary))',
          color: '#fff', boxShadow: 'var(--shadow-amber)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon name="target" size={24} stroke={2.4} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="sd-eyebrow">{t.focusToday}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
            <span className="tabular" style={{ fontSize: 24, fontWeight: 900, letterSpacing: -1 }}>2h 25m</span>
            <span style={{ color: 'var(--fg3)', fontWeight: 700, fontSize: 12 }}>/ 4h</span>
          </div>
          <div style={{ height: 5, background: 'var(--fill-2)', borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #FFB97A, var(--primary))', borderRadius: 99 }} />
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <StatTile icon="zap" label={t.sessionsToday} value="5" sub="pomodoro" accent />
        <StatTile icon="flame" label={t.streak} value="12" sub={t.streakDays} />
      </div>

      <StreakWidget streak={12} days7={days7} />

      <ScheduleWidget classes={DEMO_CLASSES} now={now} />

      {/* Tasks preview */}
      <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="sd-eyebrow">{t.tasks}</div>
            <div className="sd-h3" style={{ marginTop: 2 }}>{tasks.filter(x => !x.done).length} <span style={{ color: 'var(--fg3)', fontWeight: 600 }}>aktif</span></div>
          </div>
          <button className="sd-btn sd-btn--ghost" style={{ padding: '6px 10px', fontSize: 11 }}>Tümü <Icon name="chevron-right" size={12} /></button>
        </div>
        {tasks.filter(x => !x.done).slice(0, 3).map(task => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <button className="sd-check" onClick={() => setTasks(tasks.map(x => x.id === task.id ? { ...x, done: true } : x))} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
              <div className="sd-meta" style={{ fontSize: 11 }}>{task.course} · {task.est}m</div>
            </div>
          </div>
        ))}
      </div>

      <MusicWidget />
    </div>
  );
}

function MobileTimer({ tweaks }) {
  return (
    <div style={{ padding: '60px 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="sd-eyebrow" style={{ marginBottom: 4 }}>Studyo</div>
      <h1 className="sd-h2" style={{ fontSize: 24 }}>{useT().t.timer}</h1>
      <TimerWidget density="compact" h12={tweaks.h12} />
    </div>
  );
}

function MobileTasks({ tasks, setTasks }) {
  return (
    <div style={{ padding: '60px 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="sd-eyebrow" style={{ marginBottom: 4 }}>Studyo</div>
      <h1 className="sd-h2" style={{ fontSize: 24 }}>{useT().t.tasks}</h1>
      <TasksWidget tasks={tasks} setTasks={setTasks} />
    </div>
  );
}

function MobileStats({ data, cells }) {
  const { t } = useT();
  return (
    <div style={{ padding: '60px 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="sd-eyebrow" style={{ marginBottom: 4 }}>Studyo</div>
      <h1 className="sd-h2" style={{ fontSize: 24 }}>{t.stats}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <StatTile icon="clock-3" label={t.today} value="2h 25m" sub="hedef 4h" accent />
        <StatTile icon="trophy" label={t.bestDay} value="Çar" sub="3h 50m" />
        <StatTile icon="check-check" label={t.completionRate} value="68%" sub="bu hafta" />
        <StatTile icon="zap" label={t.longestSession} value="55m" sub="dün" />
      </div>
      <WeeklyChart data={data} />
      <HeatmapWidget cells={cells} />
    </div>
  );
}

Object.assign(window, { MobileApp, MobileHome, MobileTimer, MobileTasks, MobileStats });
