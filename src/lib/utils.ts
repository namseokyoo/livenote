/**
 * Tailwind CSS 클래스 병합 유틸리티
 * 간단한 구현으로 falsy 값을 필터링하고 클래스를 병합
 *
 * @param inputs - 클래스 문자열, undefined, null, false 등
 * @returns 병합된 클래스 문자열
 */
export function cn(
  ...inputs: (string | undefined | null | false | 0 | '')[]
): string {
  return inputs.filter(Boolean).join(' ');
}

/**
 * 로컬 스토리지 키
 */
const USER_ID_KEY = 'livenote_user_id';

/**
 * 클라이언트 사이드 익명 사용자 ID 생성 및 관리
 * localStorage를 활용하여 브라우저 세션 간 ID 유지
 *
 * @returns 고유 사용자 ID (UUID v4 형식)
 */
export function generateUserId(): string {
  // 서버 사이드 렌더링 시 임시 ID 반환
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  // localStorage에서 기존 ID 확인
  const existingId = localStorage.getItem(USER_ID_KEY);
  if (existingId) {
    return existingId;
  }

  // 새 ID 생성 및 저장
  const newId = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, newId);
  return newId;
}

/**
 * 저장된 사용자 ID 가져오기
 * 없으면 null 반환 (generateUserId와 다름)
 */
export function getUserId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(USER_ID_KEY);
}

/**
 * 사용자 ID 초기화 (로그아웃 시 사용)
 */
export function clearUserId(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(USER_ID_KEY);
}
