/**
 * yt-dlp launcher. Prefers a bundled yt-dlp binary (shipped with the
 * desktop app: ../yt-dlp/yt-dlp(.exe) next to the server), then falls
 * back to `python -m yt_dlp` (dev machines / web deployments).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function ytDlpCommand() {
  const candidates = [
    process.env.YT_DLP_BIN,
    path.join(here, '..', 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_macos'),
    path.join(here, '..', 'yt-dlp', process.platform === 'win32' ? 'yt-dlp' : 'yt-dlp'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return { cmd: candidate, prefix: [] };
    } catch { /* fall through */ }
  }
  return { cmd: process.platform === 'win32' ? 'python' : 'python3', prefix: ['-m', 'yt_dlp'] };
}

export function hasBundledYtDlp() {
  const { cmd, prefix } = ytDlpCommand();
  return prefix.length === 0;
}
