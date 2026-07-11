-- 고척교회 말씀 아카이브 · sermons 테이블
-- 통합 프로젝트(xnomlgydifiqiybervtf) SQL 편집기에서 1회 실행

create table if not exists public.sermons (
  id            text primary key,               -- 유튜브 영상 ID
  title         text not null,                  -- 날짜·라벨 뗀 순수 제목
  svc_date      date,                           -- 예배일(제목에서 분리) — 날짜 조회 기준
  category      text not null default '주일설교', -- 구분: 주일설교/금요성령집회/새벽기도회/송구영신예배 등
  preacher      text default '차동혁 위임목사',
  scripture     text,                           -- 본문
  summary       text,                           -- 한 줄 요약
  points        jsonb default '[]'::jsonb,       -- [{heading, body}]
  key_verse     jsonb,                          -- {ref, text}
  questions     jsonb default '[]'::jsonb,       -- [질문]
  tags          jsonb default '[]'::jsonb,       -- [태그]
  audio_script  text,                           -- 3분 요약 대본
  audio         text,                           -- MP3 경로
  mem_verse_no  int,                            -- 성경암송 대응 구절 번호
  mem_ref       text,                           -- 암송구절 refShort
  mem_text      text,                           -- 암송구절 본문
  hidden        boolean not null default false, -- 숨김
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists sermons_date_idx on public.sermons (svc_date desc);
create index if not exists sermons_category_idx on public.sermons (category);

-- RLS: 공개 읽기는 Edge Function(service_role)으로만 처리하므로 테이블은 잠가둠
alter table public.sermons enable row level security;
-- (anon 직접 접근 정책 없음 — getSermons Edge Function이 service_role로 조회)
