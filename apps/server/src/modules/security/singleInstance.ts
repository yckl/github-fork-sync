import fs from 'fs';
import { config } from '../../config.js';

export function acquireSingleInstanceLock(): boolean {
  const lockPath = config.lockFilePath;

  if (fs.existsSync(lockPath)) {
    try {
      const content = fs.readFileSync(lockPath, 'utf8').trim();
      const pid = parseInt(content, 10);
      if (!isNaN(pid) && pid > 0) {
        // Check if process with PID is actually running
        try {
          process.kill(pid, 0);
          // Process is still running!
          return false;
        } catch (e: any) {
          // ESRCH means process doesn't exist, stale lock
          if (e.code === 'ESRCH') {
            fs.unlinkSync(lockPath);
          } else {
            // EPERM means process exists but we lack permission to signal
            return false;
          }
        }
      }
    } catch {
      // If error reading lock, attempt to rewrite
    }
  }

  try {
    fs.writeFileSync(lockPath, process.pid.toString(), 'utf8');
    
    // Register cleanup hooks
    const cleanUp = () => {
      try {
        if (fs.existsSync(lockPath)) {
          const current = fs.readFileSync(lockPath, 'utf8').trim();
          if (current === process.pid.toString()) {
            fs.unlinkSync(lockPath);
          }
        }
      } catch {}
    };

    process.on('exit', cleanUp);
    process.on('SIGINT', () => {
      cleanUp();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanUp();
      process.exit(0);
    });

    return true;
  } catch (err) {
    return false;
  }
}
