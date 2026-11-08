/**
 * Global yt-dlp concurrency pool. Each yt-dlp resolution spawns a python
 * process (~300-500ms CPU); unbounded parallel spawns (autoplay + preload +
 * chapters + import) can pin the machine. At most MAX concurrent slots,
 * the rest queue (FIFO).
 */
const MAX_CONCURRENT = 4;
let active = 0;
const waiters = [];

export function withYtDlpSlot(fn) {
  return new Promise((resolve, reject) => {
    const start = () => {
      active += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          const next = waiters.shift();
          if (next) next();
        });
    };
    if (active < MAX_CONCURRENT) start();
    else waiters.push(start);
  });
}

export const ytdlpPoolStatus = () => ({ active, waiting: waiters.length });
