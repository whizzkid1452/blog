import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const siteLayoutSource = readFileSync(new URL('./site-layout.tsx', import.meta.url), 'utf8');
const mobileNavigationDialogSource = readFileSync(new URL('./mobile-navigation-dialog.tsx', import.meta.url), 'utf8');

describe('site navigation component sharing', () => {
  it('uses the same navigation content component in desktop and mobile containers', () => {
    expect(siteLayoutSource).toContain('<SiteNavigationContent');
    expect(mobileNavigationDialogSource).toContain('<SiteNavigationContent');
  });
});
