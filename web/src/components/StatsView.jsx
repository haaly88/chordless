import { useMemo } from 'react';
import { Clock, Headphones, Users } from 'lucide-react';
import usePlayer from '../store.js';
import { pluralize } from '../lib/format.js';

/** Your listening stats, computed from local play history. */
export default function StatsView() {
  const history = usePlayer((s) => s.history);
  const playTrack = usePlayer((s) => s.playTrack);

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

    return { totalPlays, totalSeconds, topArtists, topTracks, days, maxDay };
  }, [history]);

  const hours = Math.floor(stats.totalSeconds / 3600);
  const minutes = Math.round((stats.totalSeconds % 3600) / 60);

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
      <h1 className="view-title">Your stats<span className="sub">FROM YOUR LISTENING</span></h1>

      {/* headline cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon red"><Headphones size={20} /></div>
          <div><b>{stats.totalPlays}</b><span>Total plays</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Clock size={20} /></div>
          <div><b>{hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}</b><span>Time listening</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Users size={20} /></div>
          <div><b>{stats.topArtists[0]?.[0] || '—'}</b><span>Top artist</span></div>
        </div>
      </div>

      {/* 7-day bar chart */}
      <div className="chart-card">
        <div className="section-label" style={{ padding: 0, marginBottom: 14 }}>LAST 7 DAYS</div>
        <div className="chart-bars">
          {stats.days.map((d, i) => (
            <div key={i} className="chart-col">
              <div className="chart-bar-wrap">
                <div className="chart-bar" style={{ height: `${(d.count / stats.maxDay) * 100}%` }} />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="two-col">
        {/* top artists */}
        <section className="chart-card">
          <div className="section-label" style={{ padding: 0, marginBottom: 10 }}>TOP ARTISTS</div>
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
          <div className="section-label" style={{ padding: 0, marginBottom: 10 }}>TOP TRACKS</div>
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
