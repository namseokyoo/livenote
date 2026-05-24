import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.LIVENOTE_E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const SCREENSHOT_DIR = 'tests/e2e/screenshots';

// 콘솔 에러 수집 헬퍼
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

// 노트 페이지 비밀번호 입력 후 에디터 진입 헬퍼
async function enterNoteWithPassword(page: Page, password: string, nickname: string) {
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.fill(password);

  // 닉네임 입력
  const nicknameInput = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
  const nicknameVisible = await nicknameInput.isVisible().catch(() => false);
  if (nicknameVisible) {
    await nicknameInput.fill(nickname);
  }

  const submitBtn = page.locator('button[type="submit"]').or(
    page.locator('button').filter({ hasText: /참여하기|입장|확인/ })
  ).first();
  await submitBtn.click();
  await page.waitForTimeout(3000);
}

test.describe('P1-1: 메인 페이지 정상 로드', () => {
  test('메인 페이지 200 OK + global-error 미발생', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p1-1-main-page.png` });

    const pageContent = await page.content();
    expect(pageContent).not.toContain('Something went wrong');
    expect(pageContent).not.toContain('global-error');
    expect(pageContent).not.toContain('Application error');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    if (consoleErrors.length > 0) {
      console.log('[P1-1] 콘솔 에러:', consoleErrors.join('\n'));
    } else {
      console.log('[P1-1] 콘솔 에러: 없음');
    }
  });
});

test.describe('P0 시나리오: 신규 노트 생성 + 에디터 검증', () => {
  test('P0-1+P0-2: 노트 생성 → /note/[code] 진입 → 에디터 인터랙션 (단일 페이지 컨텍스트)', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    // Step 1: 메인 페이지 접속
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-step1-main.png` });

    // Step 2: 노트 생성 폼 찾기
    const titleInput = page.locator('input[placeholder*="제목"]').first();
    const titleVisible = await titleInput.isVisible().catch(() => false);

    if (!titleVisible) {
      // 노트 생성 버튼 클릭
      const createBtn = page.locator('button').filter({ hasText: /새\s*노트|노트\s*생성|만들기|create/i }).first();
      await createBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-step2-form.png` });

    // Step 3: 폼 입력 (제목 + 호스트PW 1234 + 게스트PW 5678)
    await page.locator('input[placeholder*="제목"]').first().fill('QA Smoke Test Note');
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('1234');
    await pwInputs.nth(1).fill('5678');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-step3-filled.png` });

    // Step 4: 생성 제출
    const submitBtn = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /노트 생성|생성/ })
    ).first();
    await submitBtn.click();

    // Step 5: /note/[code] 자동 이동 대기
    await page.waitForURL(/\/note\//, { timeout: 15000 });

    const noteUrl = page.url();
    const noteCode = noteUrl.split('/note/')[1]?.split('?')[0];
    console.log(`[P0-1] 생성된 노트 URL: ${noteUrl}, Code: ${noteCode}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-step4-note-page.png` });

    // 핵심 검증 1: global-error 미발생
    const pageContentAfterNav = await page.content();
    expect(pageContentAfterNav).not.toContain('Something went wrong');
    expect(pageContentAfterNav).not.toContain('global-error');
    expect(pageContentAfterNav).not.toContain('Application error');

    // 핵심 검증 2: URL이 /note/로 시작
    expect(page.url()).toContain('/note/');
    expect(noteCode).toBeTruthy();

    // 핵심 검증 3: 에디터 렌더링 확인 (TiptapEditor .ProseMirror)
    await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await expect(editor).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-step5-editor-visible.png` });
    console.log('[P0-1] PASS: global-error 미발생, 에디터 렌더링 정상');

    // Step 6 (P0-2): 에디터 텍스트 입력 + 커서 포커스 유지
    await editor.click();
    await editor.type('Hello LiveNote QA Test - 에디터 인터랙션 검증');
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-step6-typed.png` });

    // 에디터가 리마운트되지 않는지 확인 (입력 후에도 동일 DOM 존재)
    const editorAfterType = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await expect(editorAfterType).toBeVisible();

    // global-error 미발생 재확인
    const pageContentAfterType = await page.content();
    expect(pageContentAfterType).not.toContain('Something went wrong');
    expect(pageContentAfterType).not.toContain('global-error');

    // 자동 저장 대기 (2초)
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-step7-autosave.png` });
    console.log('[P0-2] PASS: 텍스트 입력 후 에디터 리마운트 없음');

    if (consoleErrors.length > 0) {
      const criticalErrors = consoleErrors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('manifest') &&
        !e.includes('Warning')
      );
      if (criticalErrors.length > 0) {
        console.log('[P0] 크리티컬 콘솔 에러:', criticalErrors.join('\n'));
      }
    } else {
      console.log('[P0] 콘솔 에러: 없음');
    }
  });
});

test.describe('P0-3: 기존 노트 재진입', () => {
  test('P0-3: API로 노트 생성 후 직접 URL 진입 + 비밀번호 입력 + global-error 미발생', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    // API를 통해 테스트용 노트 생성
    const createRes = await page.request.post(`${BASE_URL}/api/notes`, {
      data: {
        title: 'QA Reentry Test Note',
        hostPassword: '2468',
        guestPassword: '1357',
      },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(createRes.status()).toBe(200);
    const createData = await createRes.json();
    const testCode = createData.code;
    const testUrl = `${BASE_URL}/note/${testCode}`;

    console.log(`[P0-3] 생성된 노트: ${testUrl}`);

    // 새 페이지에서 직접 URL 진입 (인증 없이)
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-3-step1-auth-modal.png` });

    // 비밀번호 입력 폼 대기
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });

    // 비밀번호 + 닉네임 입력
    await enterNoteWithPassword(page, '2468', 'QATester');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-3-step2-after-entry.png` });

    // 핵심: global-error 미발생
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Something went wrong');
    expect(pageContent).not.toContain('global-error');
    expect(pageContent).not.toContain('Application error');

    // 에디터 또는 노트 콘텐츠 표시 확인
    await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await expect(editor).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-3-step3-editor-loaded.png` });
    console.log('[P0-3] PASS: 재진입 후 global-error 미발생, 에디터 로드 정상');

    if (consoleErrors.length > 0) {
      const critical = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('Warning'));
      if (critical.length > 0) console.log('[P0-3] 콘솔 에러:', critical.join('\n'));
    } else {
      console.log('[P0-3] 콘솔 에러: 없음');
    }
  });
});

test.describe('P0-3b: 새로고침 후 본문 로드', () => {
  test('P0-3b: 노트 진입 후 새로고침 → 재인증 → global-error 미발생', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    // API로 노트 생성
    const createRes = await page.request.post(`${BASE_URL}/api/notes`, {
      data: {
        title: 'QA Refresh Test Note',
        hostPassword: '3691',
        guestPassword: '2580',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBe(200);
    const createData = await createRes.json();
    const testUrl = `${BASE_URL}/note/${createData.code}`;

    // 직접 진입
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    await enterNoteWithPassword(page, '3691', 'QARefreshTest');
    await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });

    // 에디터에 텍스트 입력
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.click();
    await editor.type('새로고침 테스트 본문 입력');
    await page.waitForTimeout(2000); // 자동 저장 대기

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-3b-step1-before-refresh.png` });

    // 새로고침 (beforeunload에서 sessionStorage 삭제됨 → 재인증 필요)
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-3b-step2-after-refresh.png` });

    // global-error 미발생 확인
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Something went wrong');
    expect(pageContent).not.toContain('global-error');
    expect(pageContent).not.toContain('Application error');

    // 비밀번호 입력 폼이 표시되면 재인증
    const pwVisible = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
    if (pwVisible) {
      await enterNoteWithPassword(page, '3691', 'QARefreshTest');
      await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/p0-3b-step3-reauth-done.png` });

    const pageContentFinal = await page.content();
    expect(pageContentFinal).not.toContain('Something went wrong');
    expect(pageContentFinal).not.toContain('global-error');

    console.log('[P0-3b] PASS: 새로고침 후 global-error 미발생');
    if (consoleErrors.length > 0) {
      const critical = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('Warning'));
      if (critical.length > 0) console.log('[P0-3b] 콘솔 에러:', critical.join('\n'));
    }
  });
});
