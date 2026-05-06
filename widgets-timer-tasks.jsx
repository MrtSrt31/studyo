/* global React, Icon, useT, fmtTime, fmtClock, fmtMinsHrs, useInterval, useLocal, DEMO_WEEK, makeHeatmap */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ============================================================
   POMODORO / TIMER widget
   ============================================================ */
function TimerWidget({ density, h12 }) {
  const { t } = useT();
  const [mode, setMode] = useState("pomodoro"); // pomodoro | stopwatch | countdown
  const [phase, setPhase] = useState("focus");  // focus | rest
  const [cycle, setCycle] = useState(1);
  const [focusMin, setFocusMin] = useLocal("studyo:focus", 25);
  const [restMin, setRestMin] = useLocal("studyo:rest", 5);
  const [countMin, setCountMin] = useLocal("studyo:count", 30);
  const [secs, setSecs] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [stopwatchSecs, setStopwatchSecs] = useState(0);
  const [todayFocus, setTodayFocus] = useLocal("studyo:todayFocus", 145); // minutes
  const [now, setNow] = useState(new Date());

  useInterval(() => setNow(new Date()), 1000);

  const total = mode === "pomodoro"
    ? (phase === "focus" ? focusMin : restMin) * 60
    : mode === "countdown" ? countMin * 60 : 0;

  // Running tick
  useInterval(() => {
    if (!running) return;
    if (mode === "stopwatch") {
      setStopwatchSecs(s => s + 1);
      if (Math.floor((stopwatchSecs + 1) % 60) === 0) {
        setTodayFocus(f => f + 1);
      }
    } else {
      setSecs(s => {
        if (s <= 1) {
          // tick over
          if (mode === "pomodoro") {
            if (phase === "focus") {
              setTodayFocus(f => f + focusMin);
              setPhase("rest");
              return restMin * 60;
            } else {
              setPhase("focus");
              setCycle(c => c + 1);
              return focusMin * 60;
            }
          } else {
            setRunning(false);
            return 0;
          }
        }
        return s - 1;
      });
    }
  }, running ? 1000 : null);

  // Reset when settings change & not running
  useEffect(() => {
    if (!running && mode === "pomodoro") setSecs((phase === "focus" ? focusMin : restMin) * 60);
  }, [focusMin, restMin, phase, mode]);
  useEffect(() => {
    if (!running && mode === "countdown") setSecs(countMin * 60);
  }, [countMin, mode]);

  const display = mode === "stopwatch" ? stopwatchSecs : secs;
  const progress = total > 0 ? 1 - secs / total : (mode === "stopwatch" ? (stopwatchSecs % 3600) / 3600 : 0);
  const ringSize = density === "compact" ? 200 : 240;
  const ringStroke = 14;
  const r = (ringSize - ringStroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  const onStart = () => setRunning(r => !r);
  const onReset = () => {
    setRunning(false);
    if (mode === "pomodoro") { setSecs((phase === "focus" ? focusMin : restMin) * 60); }
    else if (mode === "countdown") setSecs(countMin * 60);
    else setStopwatchSecs(0);
  };
  const onSkip = () => {
    if (mode !== "pomodoro") return;
    if (phase === "focus") {
      setTodayFocus(f => f + Math.floor((focusMin * 60 - secs) / 60));
      setPhase("rest"); setSecs(restMin * 60);
    } else {
      setPhase("focus"); setSecs(focusMin * 60); setCycle(c => c + 1);
    }
  };

  const phaseColor = phase === "focus" ? "var(--primary)" : "var(--success)";

  return (
    <div className="sd-card sd-card-pad timer-widget" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="sd-eyebrow">{t.timer}</div>
          <div className="sd-h3" style={{ fontWeight: 800 }}>
            {mode === "pomodoro" ? (phase === "focus" ? t.focus : t.rest) :
             mode === "stopwatch" ? t.stopwatch : t.countdown}
            {mode === "pomodoro" && <span style={{ color: 'var(--fg3)', fontWeight: 600, marginLeft: 8, fontSize: 13 }}>· {t.cycle} {cycle}</span>}
          </div>
        </div>
        <div className="sd-seg">
          <button className={`sd-seg__btn ${mode === "pomodoro" ? "sd-seg__btn--on" : ""}`} onClick={() => { setMode("pomodoro"); setRunning(false); setSecs(focusMin*60); setPhase("focus"); }}>{t.pomodoro}</button>
          <button className={`sd-seg__btn ${mode === "stopwatch" ? "sd-seg__btn--on" : ""}`} onClick={() => { setMode("stopwatch"); setRunning(false); }}>{t.stopwatch}</button>
          <button className={`sd-seg__btn ${mode === "countdown" ? "sd-seg__btn--on" : ""}`} onClick={() => { setMode("countdown"); setRunning(false); setSecs(countMin*60); }}>{t.countdown}</button>
        </div>
      </div>

      {/* Ring */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', padding: '8px 0' }}>
        <svg width={ringSize} height={ringSize} className="sd-ring">
          <circle cx={ringSize/2} cy={ringSize/2} r={r} fill="none" strokeWidth={ringStroke} stroke="var(--fill-2)" strokeLinecap="round" />
          {(running || progress > 0) && (
            <circle
              cx={ringSize/2} cy={ringSize/2} r={r}
              fill="none" strokeWidth={ringStroke}
              stroke={phaseColor} strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div className="tabular" style={{ fontSize: ringSize * 0.22, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1, color: 'var(--fg1)' }}>
            {fmtTime(display)}
          </div>
          <div className="sd-meta" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {running && <span className="sd-pulsing" style={{ width: 6, height: 6, borderRadius: 99, background: phaseColor }} />}
            {running ? t.inProgress : (mode === "pomodoro" ? `${focusMin} · ${restMin} ${t.minutes}` : (mode === "countdown" ? `${countMin} ${t.minutes}` : fmtClock(now, h12)))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className={`sd-btn sd-btn--lg ${running ? "" : "sd-btn--primary"}`} style={{ flex: 1 }} onClick={onStart}>
          <Icon name={running ? "pause" : "play"} size={16} />
          {running ? t.pause : (display === total || display === 0) ? t.start : t.resume}
        </button>
        <button className="sd-btn sd-btn--ghost" onClick={onReset} title={t.reset}>
          <Icon name="rotate-ccw" size={16} /> {t.reset}
        </button>
        {mode === "pomodoro" && (
          <button className="sd-btn sd-btn--ghost" onClick={onSkip} title={t.skip}>
            <Icon name="skip-forward" size={16} />
          </button>
        )}
      </div>

      {/* Settings strip */}
      {mode === "pomodoro" && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <SettingStepper label={t.focus} value={focusMin} setValue={setFocusMin} min={5} max={90} step={5} accent />
          <SettingStepper label={t.rest} value={restMin} setValue={setRestMin} min={3} max={30} step={1} />
        </div>
      )}
      {mode === "countdown" && (
        <div style={{ display: 'flex', gap: 8 }}>
          <SettingStepper label={t.minutes} value={countMin} setValue={setCountMin} min={1} max={180} step={1} accent />
        </div>
      )}

      {/* Today total */}
      <div className="sd-divider-dotted" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
        <div className="sd-meta">{t.today}</div>
        <div style={{ fontWeight: 800, color: 'var(--fg1)' }} className="tabular">{fmtMinsHrs(todayFocus, t)}</div>
      </div>
    </div>
  );
}

function SettingStepper({ label, value, setValue, min, max, step, accent }) {
  return (
    <div style={{
      flex: 1,
      background: accent ? 'var(--primary-light)' : 'var(--fill-3)',
      borderRadius: 12,
      padding: '8px 10px',
      display: 'flex', alignItems: 'center', gap: 6
    }}>
      <button className="sd-btn" style={{ padding: 4, width: 24, height: 24, borderRadius: 8, background: 'var(--surface-elevated)' }}
        onClick={() => setValue(Math.max(min, value - step))}>
        <Icon name="minus" size={12} />
      </button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div className="tabular" style={{ fontWeight: 900, fontSize: 18, lineHeight: 1, color: accent ? 'var(--primary-deep)' : 'var(--fg1)' }}>{value}</div>
        <div className="sd-eyebrow" style={{ fontSize: 9, marginTop: 2, color: accent ? 'var(--primary-deep)' : 'var(--fg3)' }}>{label}</div>
      </div>
      <button className="sd-btn" style={{ padding: 4, width: 24, height: 24, borderRadius: 8, background: 'var(--surface-elevated)' }}
        onClick={() => setValue(Math.min(max, value + step))}>
        <Icon name="plus" size={12} />
      </button>
    </div>
  );
}

/* ============================================================
   TASKS widget
   ============================================================ */
function TasksWidget({ tasks, setTasks }) {
  const { t, lang } = useT();
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const [draftPriority, setDraftPriority] = useState("med");
  const [draftDueDate, setDraftDueDate] = useState("");

  const PRIO_COLORS = { high: 'var(--danger)', med: 'var(--warning)', low: 'var(--info)' };

  const remaining = tasks.filter(x => !x.done).length;
  const total = tasks.length;
  const pct = total ? Math.round(((total - remaining) / total) * 100) : 0;

  const filtered = tasks.filter(x => filter === "all" ? true : filter === "active" ? !x.done : x.done);

  const add = () => {
    if (!draft.trim()) return;
    setTasks([...tasks, { id: Date.now(), title: draft.trim(), done: false, est: 30, priority: draftPriority, dueDate: draftDueDate }]);
    setDraft("");
    setDraftPriority("med");
    setDraftDueDate("");
  };
  const toggle = (id) => setTasks(tasks.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const remove = (id) => setTasks(tasks.filter(x => x.id !== id));

  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="sd-eyebrow">{t.tasks}</div>
          <div className="sd-h3" style={{ marginTop: 2 }}>
            {remaining} <span style={{ color: 'var(--fg3)', fontWeight: 600 }}>/ {total} {t.completionRate.toLowerCase()}</span>
          </div>
        </div>
        <div className="sd-seg">
          <button className={`sd-seg__btn ${filter === "all" ? "sd-seg__btn--on" : ""}`} onClick={() => setFilter("all")}>{t.tasks}</button>
          <button className={`sd-seg__btn ${filter === "active" ? "sd-seg__btn--on" : ""}`} onClick={() => setFilter("active")}>{t.inProgress}</button>
          <button className={`sd-seg__btn ${filter === "done" ? "sd-seg__btn--on" : ""}`} onClick={() => setFilter("done")}>{t.completed}</button>
        </div>
      </div>

      {/* Progress slim */}
      <div style={{ height: 6, background: 'var(--fill-2)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'linear-gradient(90deg, #FFB97A, var(--primary))', borderRadius: 99, transition: 'width 0.3s' }} />
      </div>

      {/* Add input */}
      <div style={{ background: 'var(--surface-elevated)', borderRadius: 14, border: '1.5px solid var(--separator)', overflow: 'hidden' }}>
        <div className="sd-input" style={{ border: 'none', borderRadius: 0, background: 'transparent', padding: '10px 12px' }}>
          <Icon name="plus" size={16} style={{ color: 'var(--fg3)' }} />
          <input
            placeholder={t.addTaskHint}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, fontWeight: 600, color: 'var(--fg1)', fontFamily: 'inherit' }}
          />
          {draft && <button className="sd-btn sd-btn--primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={add}>{t.addTask}</button>}
        </div>
        {draft && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 10px', flexWrap: 'wrap' }}>
            {(['low', 'med', 'high']).map(p => (
              <button key={p} onClick={() => setDraftPriority(p)} style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1.5px solid ${draftPriority === p ? PRIO_COLORS[p] : 'var(--separator)'}`,
                background: draftPriority === p ? PRIO_COLORS[p] + '22' : 'transparent',
                color: draftPriority === p ? PRIO_COLORS[p] : 'var(--fg3)', cursor: 'pointer', fontFamily: 'inherit',
              }}>{t[p]}</button>
            ))}
            <input type="date" value={draftDueDate} onChange={e => setDraftDueDate(e.target.value)} style={{
              marginLeft: 'auto', border: '1.5px solid var(--separator)', borderRadius: 8, padding: '3px 8px',
              fontSize: 11, fontWeight: 700, color: 'var(--fg2)', background: 'var(--fill-3)', fontFamily: 'inherit', cursor: 'pointer',
            }} />
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }} className="sd-scroll">
        {filtered.length === 0 && <div className="sd-empty"><Icon name="check-check" size={20} /> {t.completed}</div>}
        {filtered.map(task => (
          <TaskRow key={task.id} task={task} onToggle={() => toggle(task.id)} onRemove={() => remove(task.id)} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onRemove }) {
  const { t } = useT();
  const prio = task.priority || "med";
  const prioColor = prio === "high" ? "var(--danger)" : prio === "med" ? "var(--warning)" : "var(--info)";

  const todayIso = new Date().toISOString().slice(0, 10);
  const isOverdue = task.dueDate && !task.done && task.dueDate < todayIso;
  const isDueToday = task.dueDate && task.dueDate === todayIso;
  const dueDateColor = isOverdue ? 'var(--danger)' : isDueToday ? 'var(--warning)' : 'var(--fg-muted)';
  const dueDateLabel = task.dueDate ? task.dueDate.slice(5).replace('-', '/') : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 8px',
      borderRadius: 12,
      transition: 'background 0.15s',
      background: isOverdue && !task.done ? 'var(--danger-light, rgba(255,59,48,0.06))' : 'transparent',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--fill-3)'}
    onMouseLeave={e => e.currentTarget.style.background = isOverdue && !task.done ? 'var(--danger-light, rgba(255,59,48,0.06))' : 'transparent'}
    >
      <div style={{ width: 8, height: 8, borderRadius: 99, background: task.done ? 'var(--fg-muted)' : prioColor, flexShrink: 0 }} />
      <button className={`sd-check ${task.done ? "sd-check--on" : ""}`} onClick={onToggle}>
        {task.done && <Icon name="check" size={12} stroke={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: task.done ? 'var(--fg-muted)' : 'var(--fg1)',
          textDecoration: task.done ? 'line-through' : 'none',
          letterSpacing: '-0.2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 11, color: 'var(--fg3)', fontWeight: 600, flexWrap: 'wrap' }}>
          {task.course && <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0.4 }}>{task.course}</span>}
          {task.course && <span style={{ width: 3, height: 3, borderRadius: 99, background: 'var(--fg-muted)' }} />}
          <span>{task.est}m</span>
          <span style={{ color: prioColor }}>{t[prio]}</span>
          {dueDateLabel && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: dueDateColor, marginLeft: 'auto' }}>
              {isOverdue && <Icon name="alert-circle" size={10} />}
              {isDueToday && <Icon name="clock" size={10} />}
              {dueDateLabel}
            </span>
          )}
        </div>
      </div>
      <button onClick={onRemove} className="sd-btn" style={{ padding: 6, opacity: 0.5, background: 'transparent' }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

Object.assign(window, { TimerWidget, TasksWidget, SettingStepper, TaskRow });

/* ============================================================
   POMODORO / TIMER widget
   ============================================================ */
function TimerWidget({ density, h12 }) {
  const { t } = useT();
  const [mode, setMode] = useState("pomodoro"); // pomodoro | stopwatch | countdown
  const [phase, setPhase] = useState("focus");  // focus | rest
  const [cycle, setCycle] = useState(1);
  const [focusMin, setFocusMin] = useLocal("studyo:focus", 25);
  const [restMin, setRestMin] = useLocal("studyo:rest", 5);
  const [countMin, setCountMin] = useLocal("studyo:count", 30);
  const [secs, setSecs] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [stopwatchSecs, setStopwatchSecs] = useState(0);
  const [todayFocus, setTodayFocus] = useLocal("studyo:todayFocus", 145); // minutes
  const [now, setNow] = useState(new Date());

  useInterval(() => setNow(new Date()), 1000);

  const total = mode === "pomodoro"
    ? (phase === "focus" ? focusMin : restMin) * 60
    : mode === "countdown" ? countMin * 60 : 0;

  // Running tick
  useInterval(() => {
    if (!running) return;
    if (mode === "stopwatch") {
      setStopwatchSecs(s => s + 1);
      if (Math.floor((stopwatchSecs + 1) % 60) === 0) {
        setTodayFocus(f => f + 1);
      }
    } else {
      setSecs(s => {
        if (s <= 1) {
          // tick over
          if (mode === "pomodoro") {
            if (phase === "focus") {
              setTodayFocus(f => f + focusMin);
              setPhase("rest");
              return restMin * 60;
            } else {
              setPhase("focus");
              setCycle(c => c + 1);
              return focusMin * 60;
            }
          } else {
            setRunning(false);
            return 0;
          }
        }
        return s - 1;
      });
    }
  }, running ? 1000 : null);

  // Reset when settings change & not running
  useEffect(() => {
    if (!running && mode === "pomodoro") setSecs((phase === "focus" ? focusMin : restMin) * 60);
  }, [focusMin, restMin, phase, mode]);
  useEffect(() => {
    if (!running && mode === "countdown") setSecs(countMin * 60);
  }, [countMin, mode]);

  const display = mode === "stopwatch" ? stopwatchSecs : secs;
  const progress = total > 0 ? 1 - secs / total : (mode === "stopwatch" ? (stopwatchSecs % 3600) / 3600 : 0);
  const ringSize = density === "compact" ? 200 : 240;
  const ringStroke = 14;
  const r = (ringSize - ringStroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  const onStart = () => setRunning(r => !r);
  const onReset = () => {
    setRunning(false);
    if (mode === "pomodoro") { setSecs((phase === "focus" ? focusMin : restMin) * 60); }
    else if (mode === "countdown") setSecs(countMin * 60);
    else setStopwatchSecs(0);
  };
  const onSkip = () => {
    if (mode !== "pomodoro") return;
    if (phase === "focus") {
      setTodayFocus(f => f + Math.floor((focusMin * 60 - secs) / 60));
      setPhase("rest"); setSecs(restMin * 60);
    } else {
      setPhase("focus"); setSecs(focusMin * 60); setCycle(c => c + 1);
    }
  };

  const phaseColor = phase === "focus" ? "var(--primary)" : "var(--success)";

  return (
    <div className="sd-card sd-card-pad timer-widget" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="sd-eyebrow">{t.timer}</div>
          <div className="sd-h3" style={{ fontWeight: 800 }}>
            {mode === "pomodoro" ? (phase === "focus" ? t.focus : t.rest) :
             mode === "stopwatch" ? t.stopwatch : t.countdown}
            {mode === "pomodoro" && <span style={{ color: 'var(--fg3)', fontWeight: 600, marginLeft: 8, fontSize: 13 }}>· {t.cycle} {cycle}</span>}
          </div>
        </div>
        <div className="sd-seg">
          <button className={`sd-seg__btn ${mode === "pomodoro" ? "sd-seg__btn--on" : ""}`} onClick={() => { setMode("pomodoro"); setRunning(false); setSecs(focusMin*60); setPhase("focus"); }}>{t.pomodoro}</button>
          <button className={`sd-seg__btn ${mode === "stopwatch" ? "sd-seg__btn--on" : ""}`} onClick={() => { setMode("stopwatch"); setRunning(false); }}>{t.stopwatch}</button>
          <button className={`sd-seg__btn ${mode === "countdown" ? "sd-seg__btn--on" : ""}`} onClick={() => { setMode("countdown"); setRunning(false); setSecs(countMin*60); }}>{t.countdown}</button>
        </div>
      </div>

      {/* Ring */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', padding: '8px 0' }}>
        <svg width={ringSize} height={ringSize} className="sd-ring">
          <circle cx={ringSize/2} cy={ringSize/2} r={r} fill="none" strokeWidth={ringStroke} stroke="var(--fill-2)" strokeLinecap="round" />
          {(running || progress > 0) && (
            <circle
              cx={ringSize/2} cy={ringSize/2} r={r}
              fill="none" strokeWidth={ringStroke}
              stroke={phaseColor} strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div className="tabular" style={{ fontSize: ringSize * 0.22, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1, color: 'var(--fg1)' }}>
            {fmtTime(display)}
          </div>
          <div className="sd-meta" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {running && <span className="sd-pulsing" style={{ width: 6, height: 6, borderRadius: 99, background: phaseColor }} />}
            {running ? t.inProgress : (mode === "pomodoro" ? `${focusMin} · ${restMin} ${t.minutes}` : (mode === "countdown" ? `${countMin} ${t.minutes}` : fmtClock(now, h12)))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className={`sd-btn sd-btn--lg ${running ? "" : "sd-btn--primary"}`} style={{ flex: 1 }} onClick={onStart}>
          <Icon name={running ? "pause" : "play"} size={16} />
          {running ? t.pause : (display === total || display === 0) ? t.start : t.resume}
        </button>
        <button className="sd-btn sd-btn--ghost" onClick={onReset} title={t.reset}>
          <Icon name="rotate-ccw" size={16} /> {t.reset}
        </button>
        {mode === "pomodoro" && (
          <button className="sd-btn sd-btn--ghost" onClick={onSkip} title={t.skip}>
            <Icon name="skip-forward" size={16} />
          </button>
        )}
      </div>

      {/* Settings strip */}
      {mode === "pomodoro" && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <SettingStepper label={t.focus} value={focusMin} setValue={setFocusMin} min={5} max={90} step={5} accent />
          <SettingStepper label={t.rest} value={restMin} setValue={setRestMin} min={3} max={30} step={1} />
        </div>
      )}
      {mode === "countdown" && (
        <div style={{ display: 'flex', gap: 8 }}>
          <SettingStepper label={t.minutes} value={countMin} setValue={setCountMin} min={1} max={180} step={1} accent />
        </div>
      )}

      {/* Today total */}
      <div className="sd-divider-dotted" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
        <div className="sd-meta">{t.today}</div>
        <div style={{ fontWeight: 800, color: 'var(--fg1)' }} className="tabular">{fmtMinsHrs(todayFocus, t)}</div>
      </div>
    </div>
  );
}

function SettingStepper({ label, value, setValue, min, max, step, accent }) {
  return (
    <div style={{
      flex: 1,
      background: accent ? 'var(--primary-light)' : 'var(--fill-3)',
      borderRadius: 12,
      padding: '8px 10px',
      display: 'flex', alignItems: 'center', gap: 6
    }}>
      <button className="sd-btn" style={{ padding: 4, width: 24, height: 24, borderRadius: 8, background: 'var(--surface-elevated)' }}
        onClick={() => setValue(Math.max(min, value - step))}>
        <Icon name="minus" size={12} />
      </button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div className="tabular" style={{ fontWeight: 900, fontSize: 18, lineHeight: 1, color: accent ? 'var(--primary-deep)' : 'var(--fg1)' }}>{value}</div>
        <div className="sd-eyebrow" style={{ fontSize: 9, marginTop: 2, color: accent ? 'var(--primary-deep)' : 'var(--fg3)' }}>{label}</div>
      </div>
      <button className="sd-btn" style={{ padding: 4, width: 24, height: 24, borderRadius: 8, background: 'var(--surface-elevated)' }}
        onClick={() => setValue(Math.min(max, value + step))}>
        <Icon name="plus" size={12} />
      </button>
    </div>
  );
}

/* ============================================================
   TASKS widget
   ============================================================ */
function TasksWidget({ tasks, setTasks }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("all");

  const remaining = tasks.filter(x => !x.done).length;
  const total = tasks.length;
  const pct = total ? Math.round(((total - remaining) / total) * 100) : 0;

  const filtered = tasks.filter(x => filter === "all" ? true : filter === "active" ? !x.done : x.done);

  const add = () => {
    if (!draft.trim()) return;
    setTasks([...tasks, { id: Date.now(), title: draft.trim(), done: false, est: 30, priority: "med" }]);
    setDraft("");
  };
  const toggle = (id) => setTasks(tasks.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const remove = (id) => setTasks(tasks.filter(x => x.id !== id));

  return (
    <div className="sd-card sd-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="sd-eyebrow">{t.tasks}</div>
          <div className="sd-h3" style={{ marginTop: 2 }}>
            {remaining} <span style={{ color: 'var(--fg3)', fontWeight: 600 }}>/ {total} {t.completionRate.toLowerCase()}</span>
          </div>
        </div>
        <div className="sd-seg">
          <button className={`sd-seg__btn ${filter === "all" ? "sd-seg__btn--on" : ""}`} onClick={() => setFilter("all")}>{t.tasks}</button>
          <button className={`sd-seg__btn ${filter === "active" ? "sd-seg__btn--on" : ""}`} onClick={() => setFilter("active")}>{t.inProgress}</button>
          <button className={`sd-seg__btn ${filter === "done" ? "sd-seg__btn--on" : ""}`} onClick={() => setFilter("done")}>{t.completed}</button>
        </div>
      </div>

      {/* Progress slim */}
      <div style={{ height: 6, background: 'var(--fill-2)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'linear-gradient(90deg, #FFB97A, var(--primary))', borderRadius: 99, transition: 'width 0.3s' }} />
      </div>

      {/* Add input */}
      <div className="sd-input">
        <Icon name="plus" size={16} style={{ color: 'var(--fg3)' }} />
        <input
          placeholder={t.addTaskHint}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        {draft && <button className="sd-btn sd-btn--primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={add}>{t.addTask}</button>}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }} className="sd-scroll">
        {filtered.length === 0 && <div className="sd-empty"><Icon name="check-check" size={20} /> {t.completed}</div>}
        {filtered.map(task => (
          <TaskRow key={task.id} task={task} onToggle={() => toggle(task.id)} onRemove={() => remove(task.id)} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onRemove }) {
  const prio = task.priority || "med";
  const prioColor = prio === "high" ? "var(--danger)" : prio === "med" ? "var(--warning)" : "var(--info)";
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 8px',
      borderRadius: 12,
      transition: 'background 0.15s',
      background: 'transparent',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--fill-3)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <button className={`sd-check ${task.done ? "sd-check--on" : ""}`} onClick={onToggle}>
        {task.done && <Icon name="check" size={12} stroke={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: task.done ? 'var(--fg-muted)' : 'var(--fg1)',
          textDecoration: task.done ? 'line-through' : 'none',
          letterSpacing: '-0.2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 11, color: 'var(--fg3)', fontWeight: 600 }}>
          {task.course && <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0.4 }}>{task.course}</span>}
          {task.course && <span style={{ width: 3, height: 3, borderRadius: 99, background: 'var(--fg-muted)' }} />}
          <span>{task.est}m</span>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: prioColor, marginLeft: 'auto' }} />
        </div>
      </div>
      <button onClick={onRemove} className="sd-btn" style={{ padding: 6, opacity: 0.5, background: 'transparent' }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

Object.assign(window, { TimerWidget, TasksWidget, SettingStepper, TaskRow });
