import { useMemo } from 'react';
import { Clock, Headphones, Users, Flame, CalendarDays, Music2, TrendingUp, Gauge } from 'lucide-react';
import usePlayer from '../store.js';
import { pluralize } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { readPerf } from '../lib/perf.js';

/** Your listening stats, computed from local play history. */
export default function StatsView() {
  const history = usePlayer((s) => s.history);
  const playTrack = usePlayer((s) => s.playTrack);
  const lang = usePlayer((s) => s.settings.lang || 'en');

  const stats = useMemo(() => {
    const totalPlays = history.length;
    const totalSeconds = history.reduce((acc, t) => acc + (t.duration || 180), 0);

    const byArtist = new Map();
    const byTrack = new Map();
    for (const t of history) {
      const artist = t.artist || 'Unknown';
      byArtist.set(artist, (byArtist.get(artist) || 0) + 1);
      const key = t.id;
      const entry = byTrack.get(key) || { track: t, count: 0 };
      entry.count += 1;
      byTrack.set(key, entry);
    }
    const topArtists = [...byArtist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topTracks = [...byTrack.values()].sort((a, b) => b.count - a.count).slice(0, 6);

    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
      const count = history.filter((t) => t.playedAt >= dayStart.getTime() && t.playedAt < dayEnd.getTime()).length;
      days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), count });
    }
    const maxDay = Math.max(1, ...days.map((d) => d.count));

    // --- advanced: weekly totals, streak, peak hour, hourly chart, uniques ---
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
    const thisWeek = history.filter((t) => (t.playedAt || 0) >= weekAgo);
    const prevWeek = history.filter((t) => (t.playedAt || 0) >= twoWeeksAgo && (t.playedAt || 0) < weekAgo);
    const weekSeconds = thisWeek.reduce((acc, t) => acc + (t.duration || 180), 0);
    const prevWeekPlays = prevWeek.length;

    // streak: consecutive calendar days with >=1 play, counting back from today
    // (today counts if there was a play today, else start from yesterday)
    const dayKey = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
    const activeDays = new Set(history.map((t) => dayKey(new Date(t.playedAt || now))));
    let streak = 0;
    const cursor = new Date();
    if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (activeDays.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    // peak hour (0-23) + hourly distribution
    const hours24 = new Array(24).fill(0);
    for (const t of history) {
      const h = new Date(t.playedAt || now).getHours();
      hours24[h] += 1;
    }
    const peakHour = hours24.indexOf(Math.max(...hours24));
    const maxHour = Math.max(1, ...hours24);

    const uniqueArtists = byArtist.size;
    const uniqueTracks = byTrack.size;

    return { totalPlays, totalSeconds, topArtists, topTracks, days, maxDay, thisWeekPlays: thisWeek.length, weekSeconds, prevWeekPlays, streak, hours24, maxHour, peakHour, uniqueArtists, uniqueTracks };
  }, [history]);

  const hours = Math.floor(stats.totalSeconds / 3600);
  const minutes = Math.round((stats.totalSeconds % 3600) / 60);
  const weekHours = Math.floor(stats.weekSeconds / 3600);
  const weekMinutes = Math.round((stats.weekSeconds % 3600) / 60);
  const weekDelta = stats.thisWeekPlays - stats.prevWeekPlays;
  const peakLabel = `${stats.peakHour}:00`;
  const perf = readPerf();
  const heapMB = (() => {
    try {
      const used = performance.memory?.usedJSHeapSize;
      return used ? (used / 1048576).toFixed(1) : null;
    } catch { return null; }
  })();
  const conn = navigator.connection ? `${navigator.connection.effectiveType || '?'}${navigator.connection.downlink ? ` · ${navigator.connection.downlink}Mbps` : ''}` : 'n/a';

  const exportStory = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1080, 1080);
    g.addColorStop(0, '#17171f'); g.addColorStop(1, '#0d0d12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.arc(900, 160, 340, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f59e0b'; ctx.font = '800 30px sans-serif';
    ctx.fillText('MY LISTENING WEEK', 540, 130);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 130px sans-serif';
    ctx.fillText(`${weekHours > 0 ? `${weekHours}h ${weekMinutes}m` : `${weekMinutes}m`}`, 540, 300);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '600 34px sans-serif';
    ctx.fillText(`${stats.thisWeekPlays} plays · streak ${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`, 540, 400);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 44px sans-serif';
    ctx.fillText('TOP ARTIST', 540, 520);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 40px sans-serif';
    ctx.fillText((stats.topArtists[0]?.[0] || '—').slice(0, 28), 540, 590);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '600 30px sans-serif';
    ctx.fillText(`Total ${stats.totalPlays} plays · peak hour ${peakLabel}`, 540, 700);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '600 26px sans-serif';
    ctx.fillText('SHARED FROM CHORDLESS', 540, 960);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'chordless-listening-week.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  };

  if (stats.totalPlays === 0) {
    return (
      <div className="empty-state">
        <Headphones />
        <h3>No listening history yet</h3>
        <p>Stats shows up here once you’ve played some tracks — plays, minutes, your top artists and top tracks.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h1 className="view-title" style={{ margin: 0 }}>{t(lang, 'stats.title')}<span className="sub">{t(lang, 'stats.fromListening')}</span></h1>
        <button className="btn" onClick={exportStory} style={{ marginLeft: 'auto' }}>{t(lang, 'stats.exportStory')}</button>
      </div>

      {/* headline cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon red"><Headphones size={20} /></div>
          <div><b>{stats.totalPlays}</b><span>{t(lang, 'stats.totalPlays')}</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Clock size={20} /></div>
          <div><b>{hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}</b><span>{t(lang, 'stats.time')}</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Users size={20} /></div>
          <div><b>{stats.topArtists[0]?.[0] || '—'}</b><span>{t(lang, 'stats.topArtist')}</span></div>
        </div>
      </div>

      {/* advanced cards: this week, streak, peak hour, uniques */}
      <div className="stat-cards" style={{ marginTop: 10 }}>
        <div className="stat-card">
          <div className="stat-icon red"><TrendingUp size={20} /></div>
          <div><b>{stats.thisWeekPlays} plays · {weekHours > 0 ? `${weekHours}h ${weekMinutes}m` : `${weekMinutes}m`}</b><span>This week{weekDelta !== 0 ? ` (${weekDelta > 0 ? '+' : ''}${weekDelta} vs last)` : ''}</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><CalendarDays size={20} /></div>
          <div><b>{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</b><span>Listening streak</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Flame size={20} /></div>
          <div><b>{peakLabel}</b><span>Peak listening hour</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Music2 size={20} /></div>
          <div><b>{stats.uniqueArtists} artists · {stats.uniqueTracks} tracks</b><span>Unique in history</span></div>
        </div>
      </div>

      {/* 7-day bar chart */}
      <div className="chart-card" style={{ marginTop: 10 }}>
        <div className="section-label" style={{ padding: 0, marginBottom: 14 }}>{t(lang, 'stats.last7')}</div>
        <div className="chart-bars">
          {stats.days.map((d, i) => (
            <div key={i} className="chart-col">
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-2)' }}>{d.count}</span>
              <div className="chart-bar-wrap">
                <div className="chart-bar" style={{ height: `${Math.max(6, (d.count / stats.maxDay) * 100)}%` }} />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 24-hour chart */}
      <div className="chart-card" style={{ marginTop: 10 }}>
        <div className="section-label" style={{ padding: 0, marginBottom: 14 }}>{t(lang, 'stats.byHour')} · PEAK {peakLabel}</div>
        <div className="chart-bars" style={{ gap: 4 }}>
          {stats.hours24.map((count, h) => (
            <div key={h} className="chart-col" title={`${h}:00 — ${count} plays`}>
              <div className="chart-bar-wrap">
                <div className="chart-bar" style={{ height: `${(count / stats.maxHour) * 100}%` }} />
              </div>
              {h % 6 === 0 && <span>{h}</span>}
              {h % 6 !== 0 && <span> </span>}
            </div>
          ))}
        </div>
      </div>

      {/* diagnostics */}
      <div className="chart-card" style={{ marginTop: 10 }}>
        <div className="section-label" style={{ padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={13} style={{ color: 'var(--accent)' }} /> DIAGNOSTICS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: 12.5 }}>
          <div><b>{perf?.lcp != null ? `${perf.lcp}ms` : '—'}</b><small style={{ display: 'block', color: 'var(--text-3)' }}>LCP</small></div>
          <div><b>{perf?.cls != null ? perf.cls : '—'}</b><small style={{ display: 'block', color: 'var(--text-3)' }}>CLS</small></div>
          <div><b>{perf?.inp != null ? `${perf.inp}ms` : '—'}</b><small style={{ display: 'block', color: 'var(--text-3)' }}>INP</small></div>
          <div><b>{heapMB ? `${heapMB} MB` : '—'}</b><small style={{ display: 'block', color: 'var(--text-3)' }}>JS heap</small></div>
          <div><b>{conn}</b><small style={{ display: 'block', color: 'var(--text-3)' }}>Connection</small></div>
          <div><b>{perf ? `${perf.samples} samples` : 'Keep using the app'}</b><small style={{ display: 'block', color: 'var(--text-3)' }}>Telemetry</small></div>
        </div>
      </div>

      <div className="two-col">
        {/* top artists */}
        <section className="chart-card">
          <div className="section-label" style={{ padding: 0, marginBottom: 10 }}>{t(lang, 'stats.topArtists')}</div>
          {stats.topArtists.map(([artist, count], i) => (
            <div key={artist} className="rank-row">
              <span className="rank-num">{i + 1}</span>
              <div className="rank-avatar">{artist.slice(0, 1).toUpperCase()}</div>
              <div className="rank-meta"><b>{artist}</b><small>{pluralize(count, 'play')}</small></div>
            </div>
          ))}
        </section>

        {/* top tracks */}
        <section className="chart-card">
          <div className="section-label" style={{ padding: 0, marginBottom: 10 }}>{t(lang, 'stats.topTracks')}</div>
          {stats.topTracks.map(({ track, count }, i) => (
            <button key={track.id} className="rank-row as-button" onClick={() => playTrack(track, stats.topTracks.map((s) => s.track))}>
              <span className="rank-num">{i + 1}</span>
              <img className="rank-art" src={track.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
              <div className="rank-meta"><b>{track.title}</b><small>{track.artist || 'Unknown artist'} · {pluralize(count, 'play')}</small></div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
