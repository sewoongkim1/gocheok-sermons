<script lang="ts">
  import type { SermonNote } from './lib/types'
  import bundled from './data/sermons.json'
  import { getSermons } from './lib/api'

  // 테이블 우선(캐시→즉시 표시, 백그라운드 갱신), 실패 시 번들 폴백
  const CACHE_KEY = 'sermon_cache_v1'
  // startSec(설교 시작 시점)은 번들(sermons.json)에만 있고 서버 응답엔 없다 — 어느 경로로 오든 병합해 준다.
  const startById = new Map((bundled as any[]).filter((b) => b.startSec).map((b) => [b.id, b.startSec as number]))
  const withStart = (rows: SermonNote[]): SermonNote[] =>
    rows.map((r) => (startById.has(r.id) && !(r as any).startSec ? { ...r, startSec: startById.get(r.id) } : r))
  function loadInitial(): SermonNote[] {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
      if (Array.isArray(c) && c.length) return withStart(c)
    } catch {}
    return bundled as SermonNote[]
  }
  let sermons = $state<SermonNote[]>(loadInitial())

  // 앱 마운트되면 스플래시 내림(최소 1초 노출)
  $effect(() => {
    setTimeout(() => (window as any).hideSplash?.(), 1000)
  })

  $effect(() => {
    getSermons()
      .then((rows) => {
        if (rows.length) {
          sermons = withStart(rows)
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
          } catch {}
        }
      })
      .catch(() => {}) // 실패 시 캐시/번들 유지
  })

  let query = $state('')
  let selectedId = $state<string | null>(null)
  let theme = $state<'light' | 'dark' | null>(null)

  const selected = $derived(sermons.find((s) => s.id === selectedId) ?? null)
  const base = import.meta.env.BASE_URL
  let voice = $state<'f' | 'm'>('f') // 3분 요약 음성: 여성/남성(테스트 비교용)

  // ── 즐겨찾기(개인화 · localStorage) ──
  const FAV_KEY = 'sermon_favs'
  let favs = $state<string[]>(loadFavs())
  let favOnly = $state(false)
  function loadFavs(): string[] {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
    } catch {
      return []
    }
  }
  const isFav = (id: string) => favs.includes(id)
  function toggleFav(id: string) {
    favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favs))
    } catch {}
  }
  const AUDIO_VER = 'v3' // 음성 재생성 시 올림(브라우저 캐시 갱신)
  const audioSrc = $derived(
    selected?.audio
      ? base + (voice === 'm' && selected.audioAlt ? selected.audioAlt : selected.audio) + '?' + AUDIO_VER
      : '',
  )
  // 암송구절이 매칭되면 그것을 우선 표시(핵심구절과 다를 때 암송구절 사용)
  const kv = $derived(
    selected
      ? {
          ref: selected.memRef || selected.keyVerse.ref,
          text: selected.memText || selected.keyVerse.text,
          isMem: !!selected.memVerseNo,
        }
      : null,
  )

  const filtered = $derived(
    sermons.filter((s) => {
      if (favOnly && !favs.includes(s.id)) return false
      const q = query.trim().toLowerCase()
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        s.preacher.toLowerCase().includes(q) ||
        s.scripture.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      )
    }),
  )

  // ── 3분 요약 오디오 (브라우저 음성 · Web Speech) ──
  let speaking = $state(false)
  let paused = $state(false)
  let koVoice: SpeechSynthesisVoice | null = null

  function loadVoice() {
    const voices = window.speechSynthesis?.getVoices() ?? []
    // 한국어 보이스 우선(가능하면 자연스러운 것)
    koVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('ko')) ?? null
  }

  $effect(() => {
    loadVoice()
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoice)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoice)
  })

  function playAudio(script: string) {
    const synth = window.speechSynthesis
    if (!synth) {
      alert('이 브라우저는 음성 읽기를 지원하지 않아요. Chrome/Edge/Safari를 이용해 주세요.')
      return
    }
    if (speaking) {
      // 재생 중이면 일시정지/이어듣기 토글
      if (paused) {
        synth.resume()
        paused = false
      } else {
        synth.pause()
        paused = true
      }
      return
    }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(script)
    u.lang = 'ko-KR'
    if (koVoice) u.voice = koVoice
    u.rate = 1.02
    u.onend = () => {
      speaking = false
      paused = false
    }
    u.onerror = () => {
      speaking = false
      paused = false
    }
    speaking = true
    paused = false
    synth.speak(u)
  }

  function stopAudio() {
    window.speechSynthesis?.cancel()
    speaking = false
    paused = false
  }

  function open(id: string) {
    stopAudio()
    selectedId = id
    window.scrollTo(0, 0)
  }
  function back() {
    stopAudio()
    selectedId = null
  }
  function toggleTheme() {
    const root = document.documentElement
    const now =
      theme ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    theme = now === 'dark' ? 'light' : 'dark'
    root.setAttribute('data-theme', theme)
  }

  // ── 형제 앱(성경말씀 암송) 연결 ──
  const MEMORIZE_URL = 'https://gocheok.onlybible.kr/'

  let toastMsg = $state('')
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  function toast(msg: string) {
    if (toastTimer) clearTimeout(toastTimer)
    toastMsg = msg
    toastTimer = setTimeout(() => (toastMsg = ''), 2000)
  }

  function goMemorize() {
    location.href = MEMORIZE_URL
  }

  // 공유는 암송 앱을 알리는 게 목적이라 대상 링크가 이 사이트가 아니라 암송 앱이다.
  async function shareMemorize() {
    const data = {
      title: '고척교회 성경말씀 암송',
      text: '말씀을 마음에 새겨요 — 함께 성경암송! 📖',
      url: MEMORIZE_URL,
    }
    if (navigator.share) {
      try {
        await navigator.share(data)
      } catch {
        /* 사용자가 취소한 경우 — 아무것도 하지 않는다 */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(MEMORIZE_URL)
      toast('링크가 복사되었어요! 📋')
    } catch {
      window.prompt('이 링크를 복사하세요', MEMORIZE_URL)
    }
  }

  const fmtDate = (d: string) => (d ? d.replace(/-/g, '.').slice(2) : '')

  // 앱 버전은 index.html 스플래시(.splash-ver) 한 곳에서만 관리한다.
  // 예전엔 여기에도 따로 두어 헤더와 스플래시 표기가 어긋났다.

  // **굵게** 마크다운을 <strong>으로 (먼저 이스케이프 → XSS 방지).
  const emph = (raw: string) =>
    String(raw == null ? '' : raw)
      .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
</script>

<div class="min-h-screen">
  <!-- 헤더 -->
  <header class="sticky top-0 z-10 border-b border-line bg-header text-white">
    <!-- 찬양 아카이브(worship)와 같은 구성: 로고 + 제목 + 부제 -->
    <div class="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <img
          src="https://summer.onlybible.kr/logo3.png"
          alt="고척교회"
          class="h-[38px] w-[38px] flex-none object-cover object-top"
        />
        <div class="flex min-w-0 flex-col leading-tight">
          <b class="text-[17px] font-extrabold whitespace-nowrap text-white">말씀 아카이브</b>
          <span class="truncate text-[11px] text-white/75">고척교회 · 주일 설교</span>
        </div>
      </div>
      <!-- 찬양 아카이브의 .icon-btn과 같은 원형 버튼(38px, 흰색 15% 배경) -->
      <div class="flex flex-none items-center gap-2">
        <button
          onclick={goMemorize}
          class="icon-btn"
          aria-label="성경말씀 암송으로 가기"
          title="성경말씀 암송으로 가기"
        >
          📖
        </button>
        <button
          onclick={shareMemorize}
          class="icon-btn"
          aria-label="고척교회 성경말씀 암송 공유하기"
          title="고척교회 성경말씀 암송 공유하기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line>
          </svg>
        </button>
        <button onclick={toggleTheme} class="icon-btn" aria-label="테마 전환">
          {#if theme === 'dark'}
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.6v2.2M12 19.2v2.2M4.4 12H2.2M21.8 12h-2.2M6.3 6.3 4.7 4.7M19.3 19.3l-1.6-1.6M17.7 6.3l1.6-1.6M4.7 19.3l1.6-1.6" />
            </svg>
          {:else}
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </header>

  {#if toastMsg}
    <div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow-lg">
      {toastMsg}
    </div>
  {/if}

  {#if selected}
    <!-- ── 상세: AI 설교 노트 ── -->
    <main class="mx-auto max-w-3xl px-5 py-6">
      <button
        onclick={back}
        class="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition hover:text-ink"
      >
        ← 목록
      </button>

      <!-- 유튜브 플레이어 -->
      <div class="overflow-hidden rounded-xl border border-line bg-black shadow-sm">
        <div class="aspect-video">
          <iframe
            class="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${selected.id}${selected.startSec ? `?start=${selected.startSec}` : ''}`}
            title={selected.title}
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>
      <div class="mt-2 flex justify-end">
        <a
          class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition hover:text-ink"
          href={`https://youtu.be/${selected.id}${selected.startSec ? `?t=${selected.startSec}` : ''}`}
          target="_blank"
          rel="noopener"
        >
          ▶ 유튜브에서 보기{selected.startSec ? ' (설교부터)' : ''}
        </a>
      </div>

      <!-- 제목 블록 -->
      <div class="mt-6">
        <div class="font-mono text-xs tracking-wide text-gold">
          {selected.category || selected.series}{selected.date ? ` · ${fmtDate(selected.date)}` : ''}
        </div>
        <div class="mt-1 flex items-start justify-between gap-3">
          <h2 class="text-2xl font-bold tracking-tight text-ink text-balance">
            {selected.title}
          </h2>
          <button
            onclick={() => toggleFav(selected!.id)}
            aria-label="즐겨찾기"
            class="shrink-0 rounded-lg p-1 text-2xl leading-none transition {isFav(selected.id)
              ? 'text-gold'
              : 'text-ink-mute hover:text-ink-soft'}"
          >
            {isFav(selected.id) ? '★' : '☆'}
          </button>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span>{selected.preacher}</span>
          <span class="text-line">|</span>
          <span class="font-medium text-navy-2">📖 {selected.scripture}</span>
        </div>
      </div>

      <!-- 3분 요약 듣기 -->
      {#if selected.audio}
        <!-- B: 미리 생성한 뉴럴 음성 MP3 (잠금화면·백그라운드 재생 가능) -->
        <div class="mt-4 rounded-xl border border-line bg-surface p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-sm font-semibold text-ink">
              🎧 3분 요약 듣기
              <span class="font-mono text-[10px] font-normal tracking-wide text-ink-mute"
                >AI 음성</span
              >
            </div>
            {#if selected.audioAlt}
              <div class="flex overflow-hidden rounded-lg border border-line text-xs">
                <button
                  onclick={() => (voice = 'f')}
                  class="px-2.5 py-1 transition {voice === 'f'
                    ? 'bg-navy text-white'
                    : 'bg-surface text-ink-soft'}">여성</button
                >
                <button
                  onclick={() => (voice = 'm')}
                  class="px-2.5 py-1 transition {voice === 'm'
                    ? 'bg-navy text-white'
                    : 'bg-surface text-ink-soft'}">남성</button
                >
              </div>
            {/if}
          </div>
          <audio src={audioSrc} controls preload="none" class="mt-3 w-full">
            <track kind="captions" />
          </audio>
        </div>
      {:else if selected.audioScript}
        <!-- A: 브라우저 음성(Web Speech) 폴백 -->
        <div class="mt-4 flex items-center gap-2">
          <button
            onclick={() => playAudio(selected!.audioScript!)}
            class="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {#if speaking && !paused}⏸ 일시정지{:else if paused}▶ 이어 듣기{:else}▶ 3분 요약 듣기{/if}
          </button>
          {#if speaking}
            <button
              onclick={stopAudio}
              class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-ink-soft transition hover:text-ink"
            >
              ■ 정지
            </button>
          {/if}
        </div>
      {/if}

      <!-- 한 줄 요약 -->
      <p
        class="mt-5 rounded-xl border-l-3 border-gold bg-raise px-4 py-3 leading-relaxed text-ink-soft"
      >
        {@html emph(selected.summary)}
      </p>

      <!-- 핵심 포인트 -->
      <section class="mt-7">
        <h3 class="font-mono text-xs tracking-[0.12em] text-ink-mute uppercase">핵심 포인트</h3>
        <ol class="mt-3 flex flex-col gap-4">
          {#each selected.points as p, i}
            <li class="rounded-xl border border-line bg-surface p-4">
              <div class="flex items-baseline gap-2.5">
                <span class="font-mono text-sm font-bold text-gold">{i + 1}</span>
                <h4 class="font-semibold tracking-tight text-ink">{p.heading}</h4>
              </div>
              <p class="mt-2 pl-6 leading-relaxed text-ink-soft">{@html emph(p.body)}</p>
            </li>
          {/each}
        </ol>
      </section>

      <!-- 맺음말(있는 설교만) -->
      {#if selected.conclusion}
        <section class="mt-7">
          <h3 class="font-mono text-xs tracking-[0.12em] text-ink-mute uppercase">맺음말</h3>
          <p
            class="mt-3 rounded-xl border-l-3 border-navy bg-raise px-4 py-3 font-serif leading-relaxed text-ink"
          >
            {@html emph(selected.conclusion)}
          </p>
        </section>
      {/if}

      <!-- 핵심 구절(암송구절이 있으면 그것을 표시) -->
      <section class="mt-6 rounded-xl bg-navy px-5 py-5 text-white">
        <div class="font-mono text-[11px] tracking-[0.14em] text-gold-2 uppercase">
          {kv?.isMem ? '암송 구절' : '핵심 구절'}
        </div>
        <p class="mt-2 font-serif text-lg leading-relaxed text-white">
          “{kv?.text}”
        </p>
        <div class="mt-1.5 text-sm text-white/70">— {kv?.ref}</div>
        {#if selected.memVerseNo}
          <a
            href={`https://gocheok.onlybible.kr/?v=${selected.memVerseNo}`}
            target="_blank"
            rel="noreferrer"
            class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gold-2 px-3.5 py-2 text-sm font-semibold text-navy transition hover:brightness-105"
          >
            📖 {selected.memRef} 암송하기 →
          </a>
        {/if}
      </section>

      <!-- 적용 질문 -->
      <section class="mt-6">
        <h3 class="font-mono text-xs tracking-[0.12em] text-ink-mute uppercase">적용 질문</h3>
        <ul class="mt-3 flex flex-col gap-2.5">
          {#each selected.questions as q}
            <li class="flex gap-2.5 leading-relaxed text-ink-soft">
              <span class="text-gold">·</span><span>{q}</span>
            </li>
          {/each}
        </ul>
      </section>

      <!-- 태그 -->
      <div class="mt-6 mb-10 flex flex-wrap gap-2">
        {#each selected.tags as t}
          <span class="rounded-md bg-raise px-2.5 py-1 font-mono text-xs text-ink-mute">#{t}</span>
        {/each}
      </div>
    </main>
  {:else}
    <!-- ── 목록 ── -->
    <main class="mx-auto max-w-3xl px-5 py-6">
      <input
        bind:value={query}
        placeholder="설교 제목 · 설교자 · 본문 · 주제 검색"
        class="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-ink-mute focus:border-navy-2"
      />

      <div class="mt-3 flex items-center justify-between gap-3">
        <div class="font-mono text-xs text-ink-mute">{filtered.length}편의 설교 노트</div>
        <button
          onclick={() => (favOnly = !favOnly)}
          class="rounded-full border px-3 py-1 text-xs font-semibold transition {favOnly
            ? 'border-gold bg-gold text-white'
            : 'border-line bg-surface text-ink-soft hover:text-ink'}"
        >
          {favOnly ? '★' : '☆'} 즐겨찾기 {favs.length ? `(${favs.length})` : ''}
        </button>
      </div>

      <ul class="mt-4 flex flex-col gap-3">
        {#each filtered as s (s.id)}
          <li class="relative">
            <button
              onclick={() => open(s.id)}
              class="w-full rounded-xl border border-line bg-surface p-4 pr-11 text-left transition hover:border-gold hover:shadow-sm"
            >
              <div class="font-mono text-[11px] tracking-wide text-gold">
                {s.category || s.series}{s.date ? ` · ${fmtDate(s.date)}` : ''}
              </div>
              <h2 class="mt-1 font-bold tracking-tight text-ink text-balance">{s.title}</h2>
              <div class="mt-1 text-sm text-ink-soft">
                {s.preacher} · 📖 {s.scripture}
              </div>
              <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-mute">{@html emph(s.summary)}</p>
            </button>
            <button
              onclick={() => toggleFav(s.id)}
              aria-label="즐겨찾기"
              class="absolute right-2 top-2 rounded-lg p-1.5 text-lg leading-none transition hover:bg-raise {isFav(
                s.id,
              )
                ? 'text-gold'
                : 'text-ink-mute'}"
            >
              {isFav(s.id) ? '★' : '☆'}
            </button>
          </li>
        {/each}
      </ul>

      {#if filtered.length === 0}
        <p class="mt-10 text-center text-ink-mute">검색 결과가 없어요.</p>
      {/if}
    </main>
  {/if}
</div>

<style>
  /* 헤더 아이콘 버튼 — 찬양 아카이브(worship)의 .icon-btn과 동일한 규격 */
  .icon-btn {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    font-size: 17px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.24);
  }
  .icon-btn:active {
    background: rgba(255, 255, 255, 0.28);
  }
</style>
