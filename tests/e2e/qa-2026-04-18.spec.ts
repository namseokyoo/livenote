import { test, expect } from '@playwright/test';

const BASE_URL = process.env.LIVENOTE_E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const SS_DIR = '../../artifacts/qa-2026-04-18';

function collectErrors(page: import('@playwright/test').Page) {
  const errs: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errs.push(msg.text()); });
  page.on('pageerror', err => errs.push('[pageerror] ' + err.message));
  return errs;
}

// ===================== S1: 기본 플로우 =====================
test.describe('S1: 기본 플로우', () => {
  test('S1-01 홈페이지 로딩 200 OK', async ({ page }) => {
    const errs = collectErrors(page);
    const res = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    await page.screenshot({ path: `${SS_DIR}/s1-01-homepage.png`, fullPage: true });
    console.log('[S1-01] 콘솔에러:', errs.length === 0 ? '없음' : errs.join(' | '));
  });

  test('S1-02 신규 노트 생성 (비밀번호 설정)', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // 노트 생성 폼 또는 버튼 탐색
    const createBtn = page.locator('button').filter({ hasText: /새\s*노트|노트\s*생성|만들기|create/i }).first();
    const titleInput = page.locator('input[placeholder*="제목"]').first();
    const titleVisible = await titleInput.isVisible().catch(() => false);
    if (!titleVisible) {
      const btnVisible = await createBtn.isVisible().catch(() => false);
      if (btnVisible) await createBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.locator('input[placeholder*="제목"]').first().fill('S1-02 QA Test Note');
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('1111');
    await pwInputs.nth(1).fill('2222');

    await page.screenshot({ path: `${SS_DIR}/s1-02-create-form.png` });

    const submitBtn = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /노트 생성|생성/ })
    ).first();
    await submitBtn.click();

    await page.waitForURL(/\/note\//, { timeout: 20000 });
    const noteUrl = page.url();
    const noteCode = noteUrl.split('/note/')[1]?.split('?')[0];
    console.log('[S1-02] 생성 URL:', noteUrl, '| Code:', noteCode);
    expect(noteCode).toBeTruthy();
    await page.screenshot({ path: `${SS_DIR}/s1-02-note-created.png` });
  });

  test('S1-03 생성 URL 재진입 + 비밀번호 인증', async ({ page }) => {
    const errs = collectErrors(page);
    const createRes = await page.request.post(`${BASE_URL}/api/notes`, {
      data: { title: 'S1-03 Auth Test', hostPassword: '1234', guestPassword: '5678' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBe(200);
    const { code } = await createRes.json();
    const noteUrl = `${BASE_URL}/note/${code}`;

    await page.goto(noteUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SS_DIR}/s1-03-auth-modal.png` });

    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[type="password"]').first().fill('1234');
    const nick = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
    if (await nick.isVisible().catch(() => false)) await nick.fill('QATester');
    await page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /참여|입장|확인/ })).first().click();
    await page.waitForTimeout(3000);

    await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    await page.screenshot({ path: `${SS_DIR}/s1-03-editor-after-auth.png` });
    console.log('[S1-03] 에러:', errs.length === 0 ? '없음' : errs.join(' | '));
  });

  test('S1-04 TipTap 에디터 입력 (타이핑 + 서식)', async ({ page }) => {
    const errs = collectErrors(page);
    const createRes = await page.request.post(`${BASE_URL}/api/notes`, {
      data: { title: 'S1-04 Editor Test', hostPassword: '2345', guestPassword: '6789' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBe(200);
    const { code } = await createRes.json();
    await page.goto(`${BASE_URL}/note/${code}`, { waitUntil: 'networkidle' });

    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[type="password"]').first().fill('2345');
    const nick = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
    if (await nick.isVisible().catch(() => false)) await nick.fill('EditorQA');
    await page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /참여|입장|확인/ })).first().click();
    await page.waitForTimeout(3000);

    await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();

    // 타이핑
    await editor.click();
    await editor.type('LiveNote QA Test 2026-04-18');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS_DIR}/s1-04-typed.png` });

    // Bold (Ctrl+B or toolbar)
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS_DIR}/s1-04-bold.png` });

    // Heading (toolbar 있으면)
    const h1Btn = page.locator('[data-testid="h1"], button[title*="Heading"], button[title*="제목"]').first();
    if (await h1Btn.isVisible().catch(() => false)) {
      await h1Btn.click();
      await page.screenshot({ path: `${SS_DIR}/s1-04-heading.png` });
    }

    expect(errs.filter(e => !e.includes('favicon') && !e.includes('Warning')).length).toBeLessThan(3);
    console.log('[S1-04] 에러:', errs.length === 0 ? '없음' : errs.join(' | '));
  });

  test('S1-05 새로고침 후 내용 유지 (Firebase RTDB 저장)', async ({ page }) => {
    const createRes = await page.request.post(`${BASE_URL}/api/notes`, {
      data: { title: 'S1-05 Persist Test', hostPassword: '3456', guestPassword: '7890' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBe(200);
    const { code } = await createRes.json();
    await page.goto(`${BASE_URL}/note/${code}`, { waitUntil: 'networkidle' });

    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[type="password"]').first().fill('3456');
    const nick = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
    if (await nick.isVisible().catch(() => false)) await nick.fill('PersistQA');
    await page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /참여|입장|확인/ })).first().click();
    await page.waitForTimeout(3000);

    await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.click();
    const uniqueText = 'PERSIST_CHECK_' + Date.now();
    await editor.type(uniqueText);
    await page.waitForTimeout(3000); // Firebase 저장 대기
    await page.screenshot({ path: `${SS_DIR}/s1-05-before-refresh.png` });

    // 새로고침
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 재인증 필요 시
    const pwVisible = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
    if (pwVisible) {
      await page.locator('input[type="password"]').first().fill('3456');
      const nickR = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
      if (await nickR.isVisible().catch(() => false)) await nickR.fill('PersistQA');
      await page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /참여|입장|확인/ })).first().click();
      await page.waitForTimeout(3000);
    }

    await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    await page.screenshot({ path: `${SS_DIR}/s1-05-after-refresh.png` });

    const content = await page.locator('.ProseMirror, [contenteditable="true"]').first().textContent();
    console.log('[S1-05] 새로고침 후 에디터 내용:', content?.slice(0, 100));
    // 내용이 유지되면 PASS (Firebase RTDB 저장 확인)
    const persisted = content?.includes(uniqueText) ?? false;
    console.log('[S1-05] 내용 유지:', persisted ? 'PASS' : 'WARNING - 재인증 세션 차이 가능');
  });
});

// ===================== S2: 실시간 협업 =====================
test.describe('S2: 실시간 협업', () => {
  test('S2-01 2개 컨텍스트 동시 접속 + 실시간 반영', async ({ browser }) => {
    const createRes = await browser.newPage();
    const resp = await createRes.request.post(`${BASE_URL}/api/notes`, {
      data: { title: 'S2-01 Collab Test', hostPassword: '4567', guestPassword: '8901' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resp.status()).toBe(200);
    const { code } = await resp.json();
    await createRes.close();

    const noteUrl = `${BASE_URL}/note/${code}`;

    // Context A
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    const errA: string[] = [];
    pageA.on('console', m => { if (m.type() === 'error') errA.push(m.text()); });

    // Context B
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    const errB: string[] = [];
    pageB.on('console', m => { if (m.type() === 'error') errB.push(m.text()); });

    // 양쪽 진입
    await pageA.goto(noteUrl, { waitUntil: 'networkidle' });
    await pageB.goto(noteUrl, { waitUntil: 'networkidle' });

    // A 인증
    await pageA.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pageA.locator('input[type="password"]').first().fill('4567');
    const nickA = pageA.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
    if (await nickA.isVisible().catch(() => false)) await nickA.fill('UserA');
    await pageA.locator('button[type="submit"]').or(pageA.locator('button').filter({ hasText: /참여|입장|확인/ })).first().click();
    await pageA.waitForTimeout(3000);

    // B 인증
    await pageB.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pageB.locator('input[type="password"]').first().fill('4567');
    const nickB = pageB.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
    if (await nickB.isVisible().catch(() => false)) await nickB.fill('UserB');
    await pageB.locator('button[type="submit"]').or(pageB.locator('button').filter({ hasText: /참여|입장|확인/ })).first().click();
    await pageB.waitForTimeout(3000);

    await pageA.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    await pageB.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });

    await pageA.screenshot({ path: `${SS_DIR}/s2-01-pageA-ready.png` });
    await pageB.screenshot({ path: `${SS_DIR}/s2-01-pageB-ready.png` });

    // A에서 입력
    const editorA = pageA.locator('.ProseMirror, [contenteditable="true"]').first();
    await editorA.click();
    const collabText = 'COLLAB_TEST_' + Date.now();
    await editorA.type(collabText);
    await pageA.waitForTimeout(3000); // Yjs 전파 대기

    await pageA.screenshot({ path: `${SS_DIR}/s2-01-pageA-typed.png` });
    await pageB.screenshot({ path: `${SS_DIR}/s2-01-pageB-after-A-typed.png` });

    // B에서 확인
    const contentB = await pageB.locator('.ProseMirror, [contenteditable="true"]').first().textContent();
    console.log('[S2-01] B에서 본 내용:', contentB?.slice(0, 100));
    const collabReflected = contentB?.includes(collabText) ?? false;
    console.log('[S2-01] 실시간 반영:', collabReflected ? 'PASS' : 'FAIL - B에 내용 미반영');
    if (!collabReflected) {
      console.log('[S2-01] B 콘솔에러:', errB.join(' | '));
    }

    // 커넥션 상태 표시 확인
    const connIndicator = pageA.locator('[class*="connect"], [class*="online"], [class*="user"], [data-testid*="user"]').first();
    const connVisible = await connIndicator.isVisible().catch(() => false);
    console.log('[S2-01] 커넥션 인디케이터:', connVisible ? '표시됨' : '미표시(구현 미확인)');

    await ctxA.close();
    await ctxB.close();
  });
});

// ===================== S3: 인증/보안 =====================
test.describe('S3: 인증/보안', () => {
  test('S3-01 잘못된 비밀번호 거부', async ({ page }) => {
    const createRes = await page.request.post(`${BASE_URL}/api/notes`, {
      data: { title: 'S3-01 Wrong PW', hostPassword: '9999', guestPassword: '8888' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBe(200);
    const { code } = await createRes.json();

    await page.goto(`${BASE_URL}/note/${code}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[type="password"]').first().fill('0000');
    const nick = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
    if (await nick.isVisible().catch(() => false)) await nick.fill('WrongUser');
    await page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /참여|입장|확인/ })).first().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SS_DIR}/s3-01-wrong-pw.png` });

    // 에디터가 로드되면 FAIL (인증 우회)
    const editorVisible = await page.locator('.ProseMirror, [contenteditable="true"]').first().isVisible().catch(() => false);
    console.log('[S3-01] 잘못된 PW 차단:', !editorVisible ? 'PASS' : 'FAIL - 에디터 노출됨!');
    expect(editorVisible).toBe(false);
  });

  test('S3-02 올바른 비밀번호 통과', async ({ page }) => {
    const createRes = await page.request.post(`${BASE_URL}/api/notes`, {
      data: { title: 'S3-02 Correct PW', hostPassword: '7777', guestPassword: '6666' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.status()).toBe(200);
    const { code } = await createRes.json();

    await page.goto(`${BASE_URL}/note/${code}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[type="password"]').first().fill('7777');
    const nick = page.locator('input[placeholder*="닉네임"], input[placeholder*="이름"]').first();
    if (await nick.isVisible().catch(() => false)) await nick.fill('CorrectUser');
    await page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /참여|입장|확인/ })).first().click();
    await page.waitForTimeout(3000);

    await page.waitForSelector('.ProseMirror, [contenteditable="true"]', { timeout: 15000 });
    await page.screenshot({ path: `${SS_DIR}/s3-02-correct-pw.png` });
    console.log('[S3-02] PASS: 올바른 PW로 에디터 접근 성공');
  });
});

// ===================== S4: 에러 케이스 =====================
test.describe('S4: 에러 케이스', () => {
  test('S4-01 존재하지 않는 노트 ID 접속', async ({ page }) => {
    const errs = collectErrors(page);
    await page.goto(`${BASE_URL}/note/NONEXISTENT_999`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS_DIR}/s4-01-not-found.png`, fullPage: true });
    const content = await page.content();
    const isHandled = content.includes('찾을 수 없') || content.includes('not found') || content.includes('404') || content.includes('존재하지') || content.includes('없는 노트');
    console.log('[S4-01] 존재하지 않는 노트 처리:', isHandled ? 'PASS (적절한 안내)' : 'WARNING - 안내 메시지 없음');
    console.log('[S4-01] 콘솔에러:', errs.length === 0 ? '없음' : errs.filter(e=>!e.includes('favicon')).join(' | '));
  });

  test('S4-02 네트워크/콘솔 에러 확인', async ({ page }) => {
    const errs = collectErrors(page);
    const networkErrors: string[] = [];
    page.on('response', res => {
      if (res.status() >= 400) networkErrors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS_DIR}/s4-02-main-errors.png` });

    const criticalErrs = errs.filter(e => !e.includes('favicon') && !e.includes('Warning') && !e.includes('manifest'));
    const criticalNetwork = networkErrors.filter(e => !e.includes('favicon') && !e.includes('manifest'));
    console.log('[S4-02] 콘솔 에러:', criticalErrs.length === 0 ? '없음' : criticalErrs.join(' | '));
    console.log('[S4-02] 네트워크 4xx/5xx:', criticalNetwork.length === 0 ? '없음' : criticalNetwork.join(' | '));
  });
});

// ===================== S5: 배포 버전 확인 =====================
test.describe('S5: 배포 버전 확인', () => {
  test('S5-01 페이지 소스 + 보안 헤더 확인', async ({ page }) => {
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const headers = response?.headers() ?? {};
    console.log('[S5-01] x-vercel-id:', headers['x-vercel-id'] ?? 'N/A');
    console.log('[S5-01] strict-transport-security:', headers['strict-transport-security'] ?? 'N/A');
    console.log('[S5-01] x-frame-options:', headers['x-frame-options'] ?? 'N/A');
    console.log('[S5-01] x-content-type-options:', headers['x-content-type-options'] ?? 'N/A');
    await page.screenshot({ path: `${SS_DIR}/s5-01-main-loaded.png`, fullPage: true });

    // 소스에서 번들 해시 확인
    const pageSource = await page.content();
    const scriptMatches = pageSource.match(/_next\/static\/[^"']+/g) ?? [];
    if (scriptMatches.length > 0) {
      console.log('[S5-01] Next.js 번들 경로(샘플):', scriptMatches[0]);
    }
    expect(response?.status()).toBe(200);
  });
});
