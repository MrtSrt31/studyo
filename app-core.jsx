/* global React */
// Shared state, i18n, demo data, helpers for Study Dashboard

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// ---------- i18n ----------
const STRINGS = {
  tr: {
    appName: "Studyo",
    tagline: "odaklan, ilerle",
    greeting: "Hoşgeldin",
    today: "Bugün",
    thisWeek: "Bu hafta",
    yesterday: "Dün",
    tomorrow: "Yarın",
    focusToday: "Bugünkü odak",
    streak: "Streak",
    streakDays: "gün",
    pomodoro: "Pomodoro",
    stopwatch: "Kronometre",
    countdown: "Geri sayım",
    focus: "Odak",
    rest: "Mola",
    cycle: "Tur",
    start: "Başlat",
    pause: "Duraklat",
    resume: "Devam et",
    reset: "Sıfırla",
    skip: "Atla",
    tasks: "Görevler",
    addTask: "Görev ekle",
    addTaskHint: "Yeni görev yaz, Enter'a bas",
    completed: "Tamamlandı",
    inProgress: "Sürüyor",
    upcoming: "Yaklaşanlar",
    minutes: "dk",
    hours: "sa",
    of: "/",
    weeklyFocus: "Haftalık odak",
    contributions: "Aktivite",
    notes: "Hızlı not",
    notesHint: "Aklındakini buraya yaz...",
    schedule: "Bugünün dersleri",
    classOver: "Bitti",
    classNow: "Şimdi",
    classNext: "Sıradaki",
    musicTitle: "Çalışma müziği",
    spotify: "Spotify",
    ambient: "Ortam sesleri",
    rain: "Yağmur",
    cafe: "Kafe",
    forest: "Orman",
    fire: "Şömine",
    waves: "Deniz",
    keyboard: "Klavye",
    overview: "Özet",
    stats: "İstatistik",
    settings: "Ayarlar",
    timer: "Zamanlayıcı",
    library: "Kütüphane",
    home: "Anasayfa",
    light: "Açık",
    dark: "Koyu",
    compact: "Sıkışık",
    comfy: "Ferah",
    mins: ["dk", "dakika"],
    hrsTotal: "saat odak",
    longestSession: "En uzun seans",
    avgPerDay: "Günlük ort.",
    completionRate: "Tamamlama",
    sessionsToday: "Bugünkü seans",
    bestDay: "En iyi gün",
    motivational: [
      "Küçük adımlar, büyük kazanır.",
      "Odaklan. Geri kalanı sonra.",
      "İyi başla, devamı kolay.",
      "Bugün dünden bir adım önde olsun.",
      "Disiplin, motivasyondan güçlüdür."
    ],
    weekdays: ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"],
    months: ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"]
  },
  en: {
    appName: "Studyo",
    tagline: "focus, ship, repeat",
    greeting: "Hey",
    today: "Today",
    thisWeek: "This week",
    yesterday: "Yesterday",
    tomorrow: "Tomorrow",
    focusToday: "Today's focus",
    streak: "Streak",
    streakDays: "days",
    pomodoro: "Pomodoro",
    stopwatch: "Stopwatch",
    countdown: "Countdown",
    focus: "Focus",
    rest: "Break",
    cycle: "Cycle",
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset",
    skip: "Skip",
    tasks: "Tasks",
    addTask: "Add task",
    addTaskHint: "Type a task, hit Enter",
    completed: "Done",
    inProgress: "In progress",
    upcoming: "Upcoming",
    minutes: "min",
    hours: "h",
    of: "/",
    weeklyFocus: "Weekly focus",
    contributions: "Activity",
    notes: "Quick notes",
    notesHint: "Jot something down...",
    schedule: "Today's classes",
    classOver: "Done",
    classNow: "Now",
    classNext: "Next",
    musicTitle: "Study sounds",
    spotify: "Spotify",
    ambient: "Ambient",
    rain: "Rain",
    cafe: "Café",
    forest: "Forest",
    fire: "Fire",
    waves: "Waves",
    keyboard: "Keys",
    overview: "Overview",
    stats: "Stats",
    settings: "Settings",
    timer: "Timer",
    library: "Library",
    home: "Home",
    light: "Light",
    dark: "Dark",
    compact: "Compact",
    comfy: "Comfy",
    mins: ["m", "minutes"],
    hrsTotal: "hours focused",
    longestSession: "Longest session",
    avgPerDay: "Daily avg.",
    completionRate: "Completion",
    sessionsToday: "Sessions today",
    bestDay: "Best day",
    motivational: [
      "Small steps win the day.",
      "Focus. Everything else can wait.",
      "Start well, the rest follows.",
      "Be one step ahead of yesterday.",
      "Discipline beats motivation."
    ],
    weekdays: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  }
};

const I18nContext = createContext({ t: STRINGS.tr, lang: "tr", setLang: () => {} });
function useT() { return useContext(I18nContext); }

// ---------- Demo data ----------
const DEMO_TASKS = [
  { id: 1, title: "Kalkülüs ödevi — bölüm 12", done: false, course: "MATH 152", est: 60, priority: "high" },
  { id: 2, title: "Algoritma quiz çalış", done: false, course: "CENG 200", est: 45, priority: "high" },
  { id: 3, title: "Sosyoloji okuma — Bourdieu", done: true, course: "SOC 100", est: 30, priority: "low" },
  { id: 4, title: "Lab raporu temize çek", done: false, course: "PHYS 105", est: 90, priority: "med" },
  { id: 5, title: "İngilizce sunumu prova", done: false, course: "ENG 211", est: 25, priority: "med" },
  { id: 6, title: "Tarih notlarını gözden geçir", done: true, course: "HIST 102", est: 20, priority: "low" }
];

const DEMO_CLASSES = [
  { id: 1, course: "MATH 152", title: "Kalkülüs II", room: "B-103", start: "09:00", end: "10:30", color: "amber" },
  { id: 2, course: "CENG 200", title: "Algoritma Analizi", room: "U-2", start: "10:40", end: "12:10", color: "info" },
  { id: 3, course: "PHYS 105", title: "Mekanik Lab", room: "Lab-3", start: "13:30", end: "15:30", color: "success" },
  { id: 4, course: "ENG 211", title: "Akademik İngilizce", room: "C-204", start: "16:00", end: "17:30", color: "warning" }
];

// 7 days of focus minutes (Mon..Sun)
const DEMO_WEEK = [185, 145, 230, 95, 210, 75, 160]; // last value = today maybe

// 12 weeks × 7 days heatmap intensities (0..4)
function makeHeatmap() {
  const cells = [];
  for (let w = 0; w < 13; w++) {
    for (let d = 0; d < 7; d++) {
      const seed = (w * 7 + d) * 9301 + 49297;
      const r = ((seed % 233280) / 233280);
      let v = Math.floor(r * 5);
      // Sundays/Saturdays slightly less, last week today bigger
      if (d > 4 && r < 0.4) v = Math.max(0, v - 1);
      if (w === 12 && d >= 5) v = 0;
      cells.push(v);
    }
  }
  return cells;
}

// ---------- Helpers ----------
function fmtTime(secs) {
  secs = Math.max(0, Math.round(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function fmtClock(date, h12) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2,'0');
  if (h12) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }
  return `${String(h).padStart(2,'0')}:${m}`;
}
function fmtMinsHrs(mins, t) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}${t.minutes}`;
  if (m === 0) return `${h}${t.hours}`;
  return `${h}${t.hours} ${m}${t.minutes}`;
}

// useTicker — ticks every second while running, returns elapsed seconds delta
function useInterval(callback, delay) {
  const cb = useRef(callback);
  useEffect(() => { cb.current = callback; }, [callback]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => cb.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Lucide icon resolver — builds SVG from lucide's child-array data
function Icon({ name, size = 16, stroke = 2.2, className = "", style = {} }) {
  const data = window.lucide && (window.lucide[toPascal(name)] || window.lucide.icons?.[toPascal(name)]);
  if (!data) return <span className={className} style={{ display: 'inline-block', width: size, height: size, ...style }} />;
  const children = Array.isArray(data) ? data : (data.default || []);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ display: 'inline-block', flexShrink: 0, ...style }}
    >
      {children.map((c, i) => {
        if (!Array.isArray(c)) return null;
        const [tag, attrs] = c;
        const props = { key: i };
        for (const k in attrs) {
          const camel = k.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
          props[camel] = attrs[k];
        }
        return React.createElement(tag, props);
      })}
    </svg>
  );
}
function toPascal(name) {
  return name.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

// Persist state in memory only (sandbox-safe)
function useLocal(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }, [key, v]);
  return [v, setV];
}

// Expose globals
Object.assign(window, {
  STRINGS, I18nContext, useT,
  DEMO_TASKS, DEMO_CLASSES, DEMO_WEEK, makeHeatmap,
  fmtTime, fmtClock, fmtMinsHrs,
  useInterval, useLocal, Icon
});
