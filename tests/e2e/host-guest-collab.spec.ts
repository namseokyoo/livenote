import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const REQUIRED_DEPLOYED_BASE_URL = 'https://livenote-caf0d.web.app';
const BASE_URL = process.env.LIVENOTE_E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const HARNESS_DIR = path.join(
  process.cwd(),
  '.hermes/harness/livenote-deployed-e2e-smoke-2026-05-24'
);
const SCREENSHOT_DIR = path.join(HARNESS_DIR, 'screenshots');
const RUN_EVIDENCE_PATH = path.join(HARNESS_DIR, 'host-guest-run.json');

type BrowserIssue = {
  page: string;
  type: 'console' | 'pageerror' | 'response';
  message: string;
};

type CreatedNote = {
  code: string;
  title: string;
  hostPassword: string;
  guestPassword: string;
  noteUrl: string;
};

function recordBrowserIssues(page: Page, pageName: string, issues: BrowserIssue[]) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push({
        page: pageName,
        type: 'console',
        message: message.text(),
      });
    }
  });

  page.on('pageerror', (error) => {
    issues.push({
      page: pageName,
      type: 'pageerror',
      message: error.message,
    });
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();

    if (
      status >= 400 &&
      !url.includes('/favicon') &&
      !url.includes('/manifest')
    ) {
      issues.push({
        page: pageName,
        type: 'response',
        message: `${status} ${url}`,
      });
    }
  });
}

function criticalIssues(issues: BrowserIssue[]) {
  return issues.filter((issue) => (
    !issue.message.includes('favicon') &&
    !issue.message.includes('manifest') &&
    !issue.message.includes('ResizeObserver loop completed')
  ));
}

async function createNote(request: APIRequestContext, title: string): Promise<CreatedNote> {
  const hostPassword = '4826';
  const guestPassword = '9137';
  const response = await request.post(`${BASE_URL}/api/notes`, {
    data: {
      title,
      hostPassword,
      guestPassword,
    },
    headers: { 'Content-Type': 'application/json' },
  });

  expect(response.status()).toBe(200);
  const data = await response.json() as { code: string };
  expect(data.code).toBeTruthy();

  return {
    code: data.code,
    title,
    hostPassword,
    guestPassword,
    noteUrl: `${BASE_URL}/note/${data.code}`,
  };
}

async function enterNote(page: Page, note: CreatedNote, password: string, nickname: string) {
  await page.goto(note.noteUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="password"]', { timeout: 15_000 });
  await page.locator('input[type="password"]').first().fill(password);

  const nicknameInput = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
  if (await nicknameInput.isVisible().catch(() => false)) {
    await nicknameInput.fill(nickname);
  }

  await page.locator('button[type="submit"]')
    .or(page.locator('button').filter({ hasText: /참여|입장|확인/ }))
    .first()
    .click();

  await page.waitForSelector('.ProseMirror, [contenteditable]', { timeout: 20_000 });
}

async function sessionRole(page: Page, code: string) {
  return page.evaluate((noteCode) => ({
    role: sessionStorage.getItem(`note-${noteCode}-role`),
    authenticated: sessionStorage.getItem(`note-${noteCode}-auth`),
    userId: sessionStorage.getItem(`note-${noteCode}-userId`),
    nickname: sessionStorage.getItem(`note-${noteCode}-nickname`),
  }), code);
}

async function isEditorEditable(page: Page) {
  return page.locator('.ProseMirror, [contenteditable]').first().evaluate((element) => (
    (element as HTMLElement).isContentEditable
  ));
}

async function cleanupNote(request: APIRequestContext, note: CreatedNote | null) {
  if (!note) {
    return {
      attempted: false,
      status: null,
      ok: false,
      error: 'No note was created.',
    };
  }

  const response = await request.delete(`${BASE_URL}/api/notes/${note.code}`, {
    data: { password: note.hostPassword },
    headers: { 'Content-Type': 'application/json' },
  });

  return {
    attempted: true,
    status: response.status(),
    ok: response.ok(),
    error: response.ok() ? null : await response.text(),
  };
}

test.describe('deployed host+guest collaboration smoke', () => {
  test('host and guest use separate passwords, permissions, and realtime editing', async ({ browser, request }, testInfo) => {
    test.skip(
      BASE_URL !== REQUIRED_DEPLOYED_BASE_URL,
      `Set LIVENOTE_E2E_BASE_URL=${REQUIRED_DEPLOYED_BASE_URL} to run the deployed smoke.`
    );

    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const title = `E2E_DEPLOYED_SMOKE_${timestamp}`;
    const issues: BrowserIssue[] = [];
    let note: CreatedNote | null = null;
    let cleanupResult: Awaited<ReturnType<typeof cleanupNote>> | null = null;
    const screenshotPaths: string[] = [];

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    recordBrowserIssues(hostPage, 'host', issues);
    recordBrowserIssues(guestPage, 'guest', issues);

    try {
      note = await createNote(request, title);

      await Promise.all([
        enterNote(hostPage, note, note.hostPassword, 'E2E Host'),
        enterNote(guestPage, note, note.guestPassword, 'E2E Guest'),
      ]);

      const hostReady = path.join(SCREENSHOT_DIR, 'host-guest-host-ready.png');
      const guestReady = path.join(SCREENSHOT_DIR, 'host-guest-guest-ready.png');
      await hostPage.screenshot({ path: hostReady, fullPage: true });
      await guestPage.screenshot({ path: guestReady, fullPage: true });
      screenshotPaths.push(hostReady, guestReady);

      const hostSession = await sessionRole(hostPage, note.code);
      const guestSession = await sessionRole(guestPage, note.code);

      expect(hostSession).toMatchObject({
        role: 'host',
        authenticated: 'true',
        nickname: 'E2E Host',
      });
      expect(hostSession.userId).toBeTruthy();

      expect(guestSession).toMatchObject({
        role: 'guest',
        authenticated: 'true',
        nickname: 'E2E Guest',
      });
      expect(guestSession.userId).toBeTruthy();
      expect(guestSession.userId).not.toBe(hostSession.userId);

      await expect(hostPage.getByText('E2E Host')).toBeVisible({ timeout: 10_000 });
      await expect(hostPage.getByText('E2E Guest')).toBeVisible({ timeout: 15_000 });
      await expect(hostPage.getByText('호스트')).toBeVisible();
      await expect(hostPage.getByText('게스트')).toBeVisible();

      await expect(guestPage.getByText('읽기 전용 모드')).toBeVisible({ timeout: 10_000 });
      await expect(guestPage.getByRole('button', { name: /편집 권한 요청|호스트 오프라인/ })).toBeVisible({
        timeout: 10_000,
      });
      expect(await isEditorEditable(guestPage)).toBe(false);

      const hostToken = `HOST_TOKEN_${Date.now()}`;
      const hostEditor = hostPage.locator('.ProseMirror, [contenteditable]').first();
      await hostEditor.click();
      await hostEditor.type(hostToken);
      await expect(guestPage.locator('.ProseMirror, [contenteditable]').first()).toContainText(hostToken, {
        timeout: 20_000,
      });

      const hostTyped = path.join(SCREENSHOT_DIR, 'host-guest-host-token-propagated.png');
      await hostPage.screenshot({ path: hostTyped, fullPage: true });
      screenshotPaths.push(hostTyped);

      await guestPage.getByRole('button', { name: '편집 권한 요청' }).click();
      await expect(guestPage.getByText(/요청 중|승인 대기/)).toBeVisible({ timeout: 10_000 });
      await expect(hostPage.getByRole('button', { name: /승인/ })).toBeVisible({ timeout: 15_000 });
      await hostPage.getByRole('button', { name: /승인/ }).click();
      await expect(guestPage.getByText('편집 가능')).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => isEditorEditable(guestPage), { timeout: 15_000 }).toBe(true);

      const guestToken = `GUEST_TOKEN_${Date.now()}`;
      const guestEditor = guestPage.locator('.ProseMirror, [contenteditable]').first();
      await guestEditor.click();
      await guestEditor.type(` ${guestToken}`);
      await expect(hostPage.locator('.ProseMirror, [contenteditable]').first()).toContainText(guestToken, {
        timeout: 20_000,
      });

      const guestTyped = path.join(SCREENSHOT_DIR, 'host-guest-guest-token-propagated.png');
      await guestPage.screenshot({ path: guestTyped, fullPage: true });
      screenshotPaths.push(guestTyped);

      expect(criticalIssues(issues)).toEqual([]);
    } finally {
      cleanupResult = await cleanupNote(request, note);

      const runEvidence = {
        baseUrl: BASE_URL,
        note,
        roles: note
          ? {
              host: await sessionRole(hostPage, note.code).catch(() => null),
              guest: await sessionRole(guestPage, note.code).catch(() => null),
            }
          : null,
        screenshots: screenshotPaths.map((screenshotPath) => path.relative(process.cwd(), screenshotPath)),
        issues,
        criticalIssues: criticalIssues(issues),
        cleanup: cleanupResult,
        testProject: testInfo.project.name,
        retry: testInfo.retry,
      };
      writeFileSync(RUN_EVIDENCE_PATH, JSON.stringify(runEvidence, null, 2));

      await hostContext.close();
      await guestContext.close();
    }
  });
});
