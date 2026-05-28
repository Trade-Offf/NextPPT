import { dir } from 'tmp-promise';

export async function withTmpDir<T>(fn: (tmpDir: string) => Promise<T>): Promise<T> {
  const { path: tmpDir, cleanup } = await dir({ unsafeCleanup: true, prefix: 'hds-export-' });
  try {
    return await fn(tmpDir);
  } finally {
    cleanup();
  }
}
