import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { runAudit } from './index.js';
import { formatTerminalReport } from './formatters/terminal-ui.js';

interface WatchOptions {
  cwd: string;
  format: 'pretty' | 'json' | 'markdown';
  debounceMs?: number;
}

export function startWatchMode(options: WatchOptions): void {
  const { cwd, format, debounceMs = 500 } = options;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;

  const watchDirs = [cwd];
  const watchers: fs.FSWatcher[] = [];

  console.log(pc.cyan('\n👁️  Watch mode active — monitoring for file changes...\n'));
  console.log(pc.gray(`   Watching: ${cwd}`));
  console.log(pc.gray(`   Press Ctrl+C to stop\n`));

  async function runScan() {
    if (isRunning) return;
    isRunning = true;

    try {
      console.clear();
      console.log(pc.cyan(`\n🔄 File change detected — rescanning at ${new Date().toLocaleTimeString()}...\n`));

      const result = await runAudit({ cwd });

      if (format === 'json') {
        const { formatJsonReport } = await import('./formatters/json-reporter.js');
        console.log(formatJsonReport(result));
      } else {
        console.log(formatTerminalReport(result));
      }

      console.log(pc.gray('\n👁️  Watching for changes... (Ctrl+C to stop)'));
    } catch (err: any) {
      console.error(pc.red(`Error during scan: ${err?.message || err}`));
    } finally {
      isRunning = false;
    }
  }

  function onFileChange(eventType: string, filename: string | null) {
    if (!filename) return;

    // Ignore irrelevant files
    const base = path.basename(filename).toLowerCase();
    if (base.startsWith('.git') || base === 'node_modules') return;

    // Debounce rapid changes
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runScan, debounceMs);
  }

  // Start watching
  for (const dir of watchDirs) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, onFileChange);
      watchers.push(watcher);
    } catch {
      console.warn(pc.yellow(`⚠ Could not watch: ${dir}`));
    }
  }

  // Initial scan
  runScan();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(pc.gray('\n\n🛑 Watch mode stopped.'));
    for (const w of watchers) w.close();
    process.exit(0);
  });
}
