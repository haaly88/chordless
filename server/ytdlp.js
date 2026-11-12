/**
 * yt-dlp launcher. Prefers a bundled yt-dlp binary (shipped with the
 * desktop app: ../yt-dlp/yt-dlp(.exe) next to the server), then falls
 * back to `python -m yt_dlp` (dev machines / web deployments).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Make sure the bundled helper can actually be executed. */
function ensureExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
  } catch {
    try {
      spawnSync('chmod', ['+x', file], { stdio: 'ignore' });
    } catch { /* best effort */ }
  }
}

export function ytDlpCommand() {
  const candidates = [
    process.env.YT_DLP_BIN,
    path.join(here, '..', 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_macos'),
    path.join(here, '..', 'yt-dlp', process.platform === 'win32' ? 'yt-dlp' : 'yt-dlp'),
    // Container images install yt-dlp as a python package.
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        if (process.platform !== 'win32') ensureExecutable(candidate);
        return { cmd: candidate, prefix: cookieArgs() };
      }
    } catch { /* fall through */ }
  }
  return { cmd: process.platform === 'win32' ? 'python' : 'python3', prefix: [...cookieArgs(), '-m', 'yt_dlp'] };
}

/**
 * Cookies for yt-dlp.
 *
 * YouTube blocks datacenter IPs with "Sign in to confirm you're not a bot".
 * Exporting the cookies of a signed-in browser (Netscape format) and pointing
 * YT_DLP_COOKIES at the file lifts that block; YT_DLP_COOKIES_FROM_BROWSER
 * reads them straight from a local browser profile.
 */
function cookieArgs() {
  const file = String(process.env.YT_DLP_COOKIES || '').trim();
  if (file) {
    try {
      if (fs.existsSync(file)) return ['--cookies', file];
    } catch { /* ignore */ }
  }
  const browser = String(process.env.YT_DLP_COOKIES_FROM_BROWSER || '').trim();
  if (browser) return ['--cookies-from-browser', browser];
  return [];
}
export function hasBundledYtDlp() {
  const { cmd, prefix } = ytDlpCommand();
  return prefix.length === 0;
}
