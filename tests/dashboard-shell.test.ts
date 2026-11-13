import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = (path: string): Promise<string> => readFile(new URL(`../apps/site/src/${path}`, import.meta.url), 'utf8');

describe('server dashboard grid', () => {
  it('shares the column width and the content inset between the top bar and the sidebar', async () => {
    const [shell, topBar, page] = await Promise.all([read('components/dashboard/shell.ts'), read('components/ServerTopBar.tsx'), read('app/dashboard/[serverId]/page.tsx')]);
    expect(shell).toContain('min-[701px]:w-[264px] min-[1101px]:w-[clamp(264px,18vw,340px)]');
    expect(shell).toContain('min-[701px]:px-12');
    for (const source of [topBar, page]) {
      expect(source).toContain('serverColumnWidth');
      expect(source).toContain("components/dashboard/shell'".replace('components/', source === topBar ? './' : '../../../components/'));
    }
    expect(topBar).toContain('serverContentInset');
    expect(page).toContain('serverContentInset');
  });

  it('does not bring back the 5% margin that left the top bar and the content on different edges', async () => {
    const [topBar, page] = await Promise.all([read('components/ServerTopBar.tsx'), read('app/dashboard/[serverId]/page.tsx')]);
    expect(topBar).not.toContain('px-[5%]');
    expect(page).not.toContain('px-[5%]');
  });

  it('keeps the top bar controls at one size and the sidebar fixed while scrolling', async () => {
    const [topBar, page] = await Promise.all([read('components/ServerTopBar.tsx'), read('app/dashboard/[serverId]/page.tsx')]);
    for (const control of ['<LanguageIndicator fixed />', '<ThemeToggle fixed />', 'fixed />']) expect(topBar).toContain(control);
    expect(topBar).toContain('min-[701px]:sticky');
    expect(page).toContain('min-[701px]:sticky');
  });
});
