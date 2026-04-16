# LiveNote QA 이슈 목록

## 이슈 목록

| ID | 심각도 | 이슈 | 원인 | 수정 플랜 | 검증 방법 | 상태 |
|-----|--------|------|------|-----------|----------|------|
| ISSUE-001 | P2 | XSS: title에 HTML 태그 저장 가능 | POST/PATCH에서 HTML sanitize 없음 | title을 저장 전 HTML 태그 strip | XSS 페이로드로 POST 후 GET 응답 확인 | ✅ 수정됨 |
| ISSUE-002 | P3 | title 길이 제한 없음 | 입력 검증 부재 | 200자 초과 시 400 반환 | 201자 title로 POST 요청 | ✅ 수정됨 |
| ISSUE-003 | P3 | verify API에 Rate Limiting 없음 | brute-force 방어 로직 미구현 | 5회 실패 시 10분 잠금 (rateLimitMap) | 잘못된 비밀번호 6회 연속 요청 | ✅ 수정됨 |
| ISSUE-004 | P3 | 노트 목록에서 note_code 빈 문자열 반환 | mapNoteListItem에서 noteCode 없을 때 '' 반환 | listNotes 결과에서 note_code='' 필터링 | GET /api/notes 응답 확인 | ✅ 수정됨 |
| ISSUE-005 | P3 | useRealtimeNote initialContentJson 의존성 불안정 | useEffect deps에 객체 참조 포함 (무한 루프 가능) | 코드 리뷰 이슈. 현재 useMemo 없이 전달 시 렌더링마다 새 객체 생성 가능. 부모 컴포넌트에서 useMemo로 안정화 필요 | 코드 리뷰 | ⚠️ 모니터링 (BL 등록 권장) |
| ISSUE-006 | P2 | sanitize 후 빈 title 저장 가능 | `<script></script>` 등 HTML만 있는 title이 strip 후 빈 문자열로 저장됨 | sanitize 후 빈 문자열이면 400 반환 | `<script></script>` POST 요청 | ✅ 수정됨 |
| ISSUE-007 | P4 | note_code prefix 검색 미지원 | listNotes에서 note_code 완전 일치만 체크 (`item.note_code === normalizedCode`) | note_code startsWith 검색으로 변경 권장 | GET /api/notes?search=DB (2글자 prefix) | ✅ 수정됨 |

## 수정 이력

- 2026-04-07 ISSUE-001 수정: POST/PATCH title HTML 태그 strip (`replace(/<[^>]*>/g, '')`)
- 2026-04-07 ISSUE-002 수정: title 최대 200자 제한 추가
- 2026-04-07 ISSUE-003 수정: verify API rateLimitMap 추가 (5회/10분)
- 2026-04-07 ISSUE-004 수정: listNotes에서 note_code='' 필터링
- 2026-04-07 ISSUE-006 수정: sanitize 후 빈 문자열 체크 추가 (route.ts POST 핸들러)
- 2026-04-07 ISSUE-007 수정: listNotes note_code 검색을 완전 일치에서 startsWith prefix 검색으로 변경 (대소문자 무시)

## 코드 리뷰 항목 (런타임 테스트 불필요)

### 양호 항목
- usePresence.ts: onDisconnect().remove() 정상 설정 ✅
- usePresence.ts: hostStatus/{noteId} 호스트 online 상태 추적 정상 ✅
- useRealtimeNote.ts: last-write-wins 패턴 제거됨, Yjs CRDT 사용 ✅
- firebase-awareness-provider.ts: 커서 동기화 로직 정상 ✅
- note-service-firebase.ts: 비밀번호는 bcrypt+pepper 해시, 클라이언트에 비밀번호 해시 미노출 ✅
- createNoteWithPasswords: noteCodes + notes 동시 쓰기 시 transaction 사용 ✅
- deleteNoteByCode: 관련 경로 전부 null로 원자적 삭제 ✅
