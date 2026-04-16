# LiveNote: RTDB 단일 구조 설계서

> 최종 업데이트: 2026-04-07  
> 담당: Fullstack Dev (튜링)  
> 마이그레이션 경로: Supabase → Firebase (Firestore + RTDB) → RTDB 단일 구조

---

## 1. 아키텍처 원칙

- **RTDB 단일 사용** — Firestore 완전 제거
- **Anonymous Auth 유지** — 클라이언트 uid 기반 세션
- **비밀번호 보안**: bcrypt + pepper, 서버 측(API Route + Admin SDK) 전용
- **실시간 동기화**: RTDB onValue + onDisconnect
- **동시 편집**: Yjs + FirebaseAwarenessProvider (RTDB awareness/{noteId})

---

## 2. RTDB 스키마

### 2.1 notes/{noteId}
```
{
  noteId: string,
  noteCode: string,         // 6자리 코드 (대문자+숫자)
  title: string,
  isLocked: boolean,
  lockedBy: string | null,
  createdAt: number,        // timestamp ms
  lastModified: number,     // timestamp ms
  content: string,          // plain text (Tiptap 렌더 용도)
  contentJson: object | null // Tiptap JSON
}
```

### 2.2 noteSecrets/{noteId} — 서버 전용 (Rules: .read false, .write false)
```
{
  hostHash: string,   // bcrypt(hostPassword + PEPPER)
  guestHash: string,  // bcrypt(guestPassword + PEPPER)
  createdAt: number
}
```

### 2.3 noteCodes/{code}
```
{
  noteId: string,
  createdAt: number
}
```

### 2.4 participants/{noteId}/{userId}
```
{
  uid: string,
  username: string,
  role: 'host' | 'guest',
  canEdit: boolean,
  permissionStatus: 'none' | 'requested' | 'granted' | 'denied',
  permissionRequestedAt: number | null,
  joinedAt: number
}
```

### 2.5 permissions/{noteId}/{userId}
```
{
  canEdit: boolean,
  permissionStatus: 'none' | 'requested' | 'granted' | 'denied',
  requestedAt: number | null
}
```

### 2.6 presence/{noteId}/{userId}
```
{
  username: string,
  role: string,
  connectedAt: ServerTimestamp,
  lastSeenAt: ServerTimestamp
}
```

### 2.7 hostStatus/{noteId}
```
{
  online: boolean,
  lastSeen: ServerTimestamp
}
```

### 2.8 awareness/{noteId}/{userId}
```
{
  clientId: number,
  update: string,  // base64 Yjs awareness update
  updatedAt: ServerTimestamp
}
```

---

## 3. 서비스 레이어 구조

| 파일 | 용도 |
|------|------|
| `src/lib/firebase-admin.ts` | Admin SDK 초기화 (RTDB only) |
| `src/lib/firebase.ts` | Client SDK 초기화 (RTDB + Auth only) |
| `src/lib/note-service-firebase.ts` | 서버 측 RTDB Admin 함수 |
| `src/lib/note-service.ts` | 클라이언트 측 RTDB Client 함수 |
| `src/lib/firebase-awareness-provider.ts` | Yjs Awareness RTDB 동기화 |
| `src/hooks/useRealtimeNote.ts` | 콘텐츠 실시간 구독 (RTDB onValue) |
| `src/hooks/usePresence.ts` | Presence 관리 (RTDB + onDisconnect) |
| `src/hooks/useNoteLock.ts` | 잠금 상태 구독 (RTDB onValue) |
| `src/hooks/useEditPermission.ts` | 권한 구독 (RTDB participants + permissions) |

---

## 4. API Routes

| 경로 | 메서드 | 용도 |
|------|--------|------|
| `/api/notes` | GET | 노트 목록 (RTDB orderByChild lastModified) |
| `/api/notes` | POST | 노트 생성 (트랜잭션 + multi-path update) |
| `/api/notes/[code]` | GET | 노트 조회 |
| `/api/notes/[code]` | PATCH | 노트 업데이트 |
| `/api/notes/[code]` | DELETE | 노트 삭제 (비밀번호 검증 + multi-path delete) |
| `/api/notes/[code]/verify` | POST | 비밀번호 검증 + 참여자 등록 |
| `/api/notes/[code]/leave` | POST | 노트 퇴장 |
| `/api/notes/[code]/request-edit` | POST | 편집 권한 요청 |
| `/api/notes/[code]/respond-edit` | POST | 편집 권한 응답 (호스트) |

---

## 5. RTDB 인덱스 (database.rules.json)

`notes` 경로에 `lastModified`, `createdAt`, `noteCode`, `title` 인덱스 필요.
→ `database.rules.json` 참조 (Firebase Console에서 배포 필요).

---

## 6. 비밀번호 보안

1. 클라이언트에서 4자리 숫자 비밀번호 입력
2. API Route (서버)에서 bcrypt + PEPPER로 해시
3. `noteSecrets/{noteId}`에 저장 (RTDB Rules: read false, write false — Admin SDK만 접근)
4. 클라이언트에 해시 절대 노출 금지

---

## 7. 마이그레이션 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-07 | Supabase → Firebase (Firestore + RTDB) 1단계 |
| 2026-04-07 | Firestore 완전 제거 → RTDB 단일 구조 전환 |
