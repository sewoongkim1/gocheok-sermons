// 설교 노트 데이터 모델
export interface SermonPoint {
  heading: string // 소제목 (예: "먼저 침노하신 은혜")
  body: string // 설명 2~3문장
}

export interface SermonNote {
  id: string // YouTube video id
  title: string // 설교 제목
  preacher: string // 설교자
  series: string // 카테고리/시리즈 (예: "차동혁목사 주일설교")
  date: string // YYYY-MM-DD (없으면 "")
  scripture: string // 본문 (예: "누가복음 5:1-11")
  summary: string // 한 줄 요약
  points: SermonPoint[] // 핵심 포인트
  keyVerse: { ref: string; text: string } // 핵심 구절
  questions: string[] // 적용 질문
  tags: string[] // 주제 태그
  audioScript?: string // 3분 요약 오디오용 나레이션 대본(귀로 듣기 좋게 서술형)
  audio?: string // 미리 생성한 MP3 경로(여성 음성) — 있으면 네이티브 플레이어 사용
  audioAlt?: string // 비교용 남성 음성 MP3 경로(테스트용)
  memVerseNo?: number // 성경암송 앱의 대응 구절 번호(영상ID 매칭) — 딥링크용
  memRef?: string // 대응 암송구절 refShort (예: "눅 5:10")
  memText?: string // 대응 암송구절 본문 (핵심구절과 다르면 이걸 우선 표시)
}
