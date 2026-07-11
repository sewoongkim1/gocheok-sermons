<script lang="ts">
  import type { SermonNote } from './lib/types'
  import data from './data/sermons.json'

  const sermons = data as SermonNote[]

  let query = $state('')
  let selectedId = $state<string | null>(null)
  let theme = $state<'light' | 'dark' | null>(null)

  const selected = $derived(sermons.find((s) => s.id === selectedId) ?? null)
  const base = import.meta.env.BASE_URL
  let voice = $state<'f' | 'm'>('f') // 3분 요약 음성: 여성/남성(테스트 비교용)
  const audioSrc = $derived(
    selected?.audio
      ? base + (voice === 'm' && selected.audioAlt ? selected.audioAlt : selected.audio)
      : '',
  )

  const filtered = $derived(
    sermons.filter((s) => {
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

  const fmtDate = (d: string) => (d ? d.replace(/-/g, '.').slice(2) : '')
</script>

<div class="min-h-screen">
  <!-- 헤더 -->
  <header class="sticky top-0 z-10 border-b border-line bg-navy text-white">
    <div class="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
      <div class="flex-1">
        <div class="font-mono text-[11px] tracking-[0.18em] text-gold-2 uppercase">
          Gocheok Church · Sermon Notes
        </div>
        <h1 class="mt-0.5 text-lg font-bold tracking-tight text-white">
          고척교회 말씀 아카이브
        </h1>
      </div>
      <button
        onclick={toggleTheme}
        class="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/90 transition hover:bg-white/10"
        aria-label="테마 전환"
      >
        {#if theme === 'dark'}☀️{:else}🌙{/if}
      </button>
    </div>
  </header>

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
            src={`https://www.youtube-nocookie.com/embed/${selected.id}`}
            title={selected.title}
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>

      <!-- 제목 블록 -->
      <div class="mt-6">
        <div class="font-mono text-xs tracking-wide text-gold">
          {selected.series}{selected.date ? ` · ${fmtDate(selected.date)}` : ''}
        </div>
        <h2 class="mt-1 text-2xl font-bold tracking-tight text-ink text-balance">
          {selected.title}
        </h2>
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
        {selected.summary}
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
              <p class="mt-2 pl-6 leading-relaxed text-ink-soft">{p.body}</p>
            </li>
          {/each}
        </ol>
      </section>

      <!-- 핵심 구절 -->
      <section class="mt-6 rounded-xl bg-navy px-5 py-5 text-white">
        <div class="font-mono text-[11px] tracking-[0.14em] text-gold-2 uppercase">핵심 구절</div>
        <p class="mt-2 font-serif text-lg leading-relaxed text-white">
          “{selected.keyVerse.text}”
        </p>
        <div class="mt-1.5 text-sm text-white/70">— {selected.keyVerse.ref}</div>
        <a
          href="https://gocheok.onlybible.kr"
          target="_blank"
          rel="noreferrer"
          class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gold-2 px-3.5 py-2 text-sm font-semibold text-navy transition hover:brightness-105"
        >
          📖 이 본문 암송하기 →
        </a>
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

      <div class="mt-3 font-mono text-xs text-ink-mute">
        {filtered.length}편의 설교 노트
      </div>

      <ul class="mt-4 flex flex-col gap-3">
        {#each filtered as s (s.id)}
          <li>
            <button
              onclick={() => open(s.id)}
              class="w-full rounded-xl border border-line bg-surface p-4 text-left transition hover:border-gold hover:shadow-sm"
            >
              <div class="font-mono text-[11px] tracking-wide text-gold">
                {s.series}{s.date ? ` · ${fmtDate(s.date)}` : ''}
              </div>
              <h2 class="mt-1 font-bold tracking-tight text-ink text-balance">{s.title}</h2>
              <div class="mt-1 text-sm text-ink-soft">
                {s.preacher} · 📖 {s.scripture}
              </div>
              <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-mute">{s.summary}</p>
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
