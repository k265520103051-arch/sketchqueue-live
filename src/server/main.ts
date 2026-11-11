import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { createTikTokSource, parseTikTokTarget } from '../sources/tiktok';
import { createApp } from './app';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rawPort = process.env.PORT ?? '4780';
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Giá trị PORT không hợp lệ: "${rawPort}". Hãy dùng một số từ 1 đến 65535, ví dụ PORT=4781.`);
  process.exit(1);
}

const app = createApp({
  port,
  staticDir: join(root, 'dist', 'client'),
  settingsPath: join(root, 'settings.json'),
  // Chỉ đọc sự kiện công khai: không khoá ký, không session, không authenticateWs.
  liveFactory: target => {
    const parsed = parseTikTokTarget(target);
    if ('error' in parsed) return parsed;
    return createTikTokSource(parsed.handle, h => new TikTokLiveConnection(h, {}));
  },
});

try {
  const { port: bound } = await app.listen();
  console.log(`Bảng điều khiển: http://127.0.0.1:${bound}/`);
  console.log(`Sân khấu: http://127.0.0.1:${bound}/stage`);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(
      `Cổng ${port} đang bị chương trình khác dùng. Hãy tắt chương trình đó, hoặc chọn cổng khác bằng biến môi trường PORT ` +
        `(ví dụ PowerShell: $env:PORT=4781; npm start — hoặc bash: PORT=4781 npm start).`,
    );
  } else {
    console.error('Không khởi động được máy chủ:', err instanceof Error ? err.message : err);
  }
  process.exit(1);
}

let stopping = false;
function shutdown(): void {
  if (stopping) return;
  stopping = true;
  app.close().finally(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
