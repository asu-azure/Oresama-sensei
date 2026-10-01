<script lang="ts">
  // All 2,211 JLPT kanji by level, with what you've met (in a saved word) and
  // learned marked. Paste a kanji to jump to it, or search a level by meaning
  // or reading. Select mode marks many as learned at once.
  import { onMount, tick } from 'svelte';
  import Icon from '../shared/Icon.svelte';
  import { sb, requireUser } from '../../lib/supabase';
  import { LEVELS, kanjiList, levelOf, uniqueKanji, loadInfo, kanjiHref, type Level, type KanjiInfo } from '../../lib/kanji';
  import { loadKanjiCoverage, summarize, type KanjiCoverage } from '../../lib/kanji-coverage';
  import { arrive } from '../../lib/mv';

  function levelFromUrl(): Level {
    const v = new URLSearchParams(location.search).get('level');
    return (LEVELS as string[]).includes(v ?? '') ? (v as Level) : 'N5';
  }

  let level = $state<Level>(levelFromUrl());
  let q = $state('');
  let info = $state<{ level: Level; data: Record<string, KanjiInfo> } | null>(null);
  let cov = $state<KanjiCoverage | null>(null);
  let userId = '';
  let selecting = $state(false);
  let selected = $state<Set<string>>(new Set());
  let busy = $state(false);
  let restored = false;

  onMount(async () => {
    try {
      const user = await requireUser();
      userId = user.id;
      cov = await loadKanjiCoverage(sb(), user.id);
    } catch (e) {
      console.error(e);
    }
  });

  $effect(() => {
    const lv = level;
    let alive = true;
    loadInfo(lv)
      .then((data) => {
        if (alive) info = { level: lv, data };
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  });

  const ready = $derived(info && info.level === level ? info.data : null);

  // Coming back from a kanji: return to where the list was.
  $effect(() => {
    if (!ready || restored) return;
    restored = true;
    try {
      const y = Number(sessionStorage.getItem(`kanji:scroll:${level}`));
      if (y) void tick().then(() => window.scrollTo(0, y));
    } catch {}
  });

  function setLevel(lv: Level) {
    level = lv;
    const u = new URL(location.href);
    u.searchParams.set('level', lv);
    history.replaceState(history.state, '', u);
  }

  const list = $derived.by(() => {
    const query = q.trim();
    if (!query) return kanjiList(level);
    // Pasted kanji → those, from any level.
    const pasted = uniqueKanji(query).filter((k) => levelOf(k));
    if (pasted.length) return pasted;
    if (!ready) return [];
    const needle = query.toLowerCase();
    return kanjiList(level).filter((ch) => {
      const i = ready[ch];
      return !!i && (i.meanings.some((m) => m.toLowerCase().includes(needle)) || i.on.some((r) => r.includes(query)) || i.kun.some((r) => r.includes(query)));
    });
  });

  function rememberScroll() {
    try {
      sessionStorage.setItem(`kanji:scroll:${level}`, String(Math.round(window.scrollY)));
    } catch {}
  }

  function toggle(ch: string) {
    const next = new Set(selected);
    if (next.has(ch)) next.delete(ch);
    else next.add(ch);
    selected = next;
  }

  async function mark(learned: boolean) {
    if (!cov || !selected.size || busy) return;
    busy = true;
    const chars = [...selected];
    const now = new Date().toISOString();
    const { error } = await sb()
      .from('kanji')
      .upsert(
        chars.map((character) => ({ user_id: userId, character, learned, updated_at: now })),
        { onConflict: 'user_id,character' },
      );
    busy = false;
    if (error) return;
    const marked = new Set(cov.marked);
    for (const ch of chars) learned ? marked.add(ch) : marked.delete(ch);
    cov = summarize(cov.seen, cov.auto, marked);
    selected = new Set();
  }
</script>

<header class="head">
  <p class="mono">漢字 · JLPT N5–N1</p>
  <div class="head__row">
    <h1 class="head__title" use:arrive>Kanji</h1>
    <button
      type="button"
      class="chip"
      aria-pressed={selecting}
      onclick={() => {
        selecting = !selecting;
        selected = new Set();
      }}>{selecting ? 'Done' : 'Select'}</button
    >
  </div>
  <p class="head__sub">Stroke order, readings, and the parts each kanji is built from.</p>
</header>

{#if cov}
  <section class="cov" aria-label="Coverage">
    <p class="cov__total">
      <span class="serif cov__pct">{cov.overall.pct}%</span>
      <span class="dim">{cov.overall.learned} of {cov.overall.total} learned · {cov.overall.seen} met in your words</span>
    </p>
    <div class="cov__levels">
      {#each cov.perLevel as l (l.level)}
        <button type="button" class="cov__lv" class:on={level === l.level} onclick={() => setLevel(l.level)}>
          <span class="mono">{l.level}</span>
          <span class="cov__bar">
            <span class="cov__learned" style="width: {(l.learned / l.total) * 100}%"></span>
            <span class="cov__seen" style="width: {((l.seen - l.learned) / l.total) * 100}%"></span>
          </span>
          <span class="cov__n faint">{l.learned}/{l.total}</span>
        </button>
      {/each}
    </div>
  </section>
{/if}

<div class="chips levels" role="tablist">
  {#each LEVELS as lv (lv)}
    <button type="button" role="tab" class="chip" aria-selected={level === lv} aria-pressed={level === lv} onclick={() => setLevel(lv)}>
      {lv}<span class="n">{kanjiList(lv).length}</span>
    </button>
  {/each}
</div>

<div class="search">
  <Icon name="search" />
  <input class="input" type="search" bind:value={q} placeholder="Paste a kanji, or search by meaning / reading…" aria-label="Search kanji" />
</div>

<p class="legend mono">
  {list.length} kanji
  <span><span class="dot" style="--c: var(--accent-text)"></span>in your words</span>
  <span><span class="dot" style="--c: var(--m-mastered)"></span>learned</span>
  {#if selecting}<button type="button" class="quiet" onclick={() => (selected = new Set(list))}>Select all shown</button>{/if}
</p>

<div class="grid" class:pad={selecting && selected.size}>
  {#each list as ch (ch)}
    {@const isLearned = cov?.learned.has(ch)}
    {@const isSeen = cov?.seen.has(ch)}
    {#if selecting}
      <button
        type="button"
        class="tile jp-serif"
        class:learned={isLearned}
        class:seen={isSeen}
        class:sel={selected.has(ch)}
        aria-pressed={selected.has(ch)}
        onclick={() => toggle(ch)}
      >
        {ch}
        {#if selected.has(ch)}<span class="tile__sel"><Icon name="check" /></span>{/if}
      </button>
    {:else}
      <a
        class="tile jp-serif"
        class:learned={isLearned}
        class:seen={isSeen}
        href={kanjiHref(ch, level)}
        title={ready?.[ch]?.meanings.slice(0, 3).join(', ')}
        onclick={rememberScroll}
      >
        {ch}
        {#if isLearned}<span class="tile__ok"></span>{/if}
        {#if isSeen}<span class="tile__seen"></span>{/if}
      </a>
    {/if}
  {/each}
</div>
{#if !list.length}<p class="none dim">No kanji match.</p>{/if}

<p class="credit faint">
  Strokes &amp; parts: <a class="link" href="https://kanjivg.tagaini.net/" target="_blank" rel="noreferrer">KanjiVG</a> (CC BY-SA 3.0) ·
  readings &amp; meanings:
  <a class="link" href="https://github.com/davidluzgouveia/kanji-data" target="_blank" rel="noreferrer">kanji-data</a> (MIT).
</p>

{#if selecting && selected.size}
  <div class="bulk">
    <span class="mono">{selected.size} selected</span>
    <button type="button" class="btn btn--sm btn--lead" disabled={busy} onclick={() => mark(true)}><Icon name="check" /> Mark learned</button>
    <button type="button" class="btn btn--sm" disabled={busy} onclick={() => mark(false)}>Unmark</button>
    <button type="button" class="icon-btn" aria-label="Clear selection" onclick={() => (selected = new Set())}><Icon name="x" /></button>
  </div>
{/if}

<style>
  .cov {
    display: grid;
    gap: 0.8rem;
    padding: 1rem 1.1rem;
    margin-bottom: 1.2rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .cov__total {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4rem 0.8rem;
    font-size: 0.85rem;
  }
  .cov__pct {
    font-size: 2rem;
    line-height: 1;
  }
  .cov__levels {
    display: grid;
    gap: 0.35rem;
  }
  .cov__lv {
    display: grid;
    grid-template-columns: 2rem 1fr 5.2rem;
    align-items: center;
    gap: 0.7rem;
    padding: 0.15rem 0;
    text-align: left;
  }
  .cov__lv.on .mono {
    color: var(--accent-text);
  }
  .cov__bar {
    display: flex;
    height: 6px;
    border-radius: 6px;
    background: var(--line);
    overflow: hidden;
  }
  .cov__learned {
    background: var(--m-mastered);
  }
  .cov__seen {
    background: color-mix(in srgb, var(--accent-text) 45%, transparent);
  }
  .cov__n {
    font-size: 0.72rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .levels {
    margin-bottom: 0.8rem;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 1.1rem;
    margin: 0.9rem 0 0.8rem;
  }
  .legend > span {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(3.4rem, 1fr));
    gap: 0.45rem;
  }
  .grid.pad {
    padding-bottom: 5rem;
  }
  .tile {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border: 1px solid var(--line);
    border-radius: 10px;
    font-size: 1.6rem;
    transition:
      border-color 0.2s var(--ease),
      background 0.2s var(--ease),
      translate 0.2s var(--ease);
  }
  @media (hover: hover) {
    .tile:hover {
      border-color: var(--accent-text);
      translate: 0 -2px;
    }
  }
  .tile.seen {
    border-color: color-mix(in srgb, var(--accent-text) 40%, transparent);
  }
  .tile.learned {
    border-color: color-mix(in srgb, var(--m-mastered) 60%, transparent);
    background: color-mix(in srgb, var(--m-mastered) 10%, transparent);
  }
  .tile.sel {
    border-color: var(--accent-text);
    background: var(--accent-soft);
  }
  .tile__ok,
  .tile__seen {
    position: absolute;
    right: 0.3rem;
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
  }
  .tile__ok {
    top: 0.3rem;
    background: var(--m-mastered);
  }
  .tile__seen {
    bottom: 0.3rem;
    background: var(--accent-text);
  }
  .tile__sel {
    position: absolute;
    top: 0.2rem;
    left: 0.2rem;
    display: inline-flex;
    padding: 0.1rem;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 0.6rem;
  }
  .none {
    padding: 2rem 0;
    text-align: center;
  }
  .credit {
    margin-top: 2rem;
    font-size: 0.72rem;
    text-align: center;
  }
  .bulk {
    position: fixed;
    left: 50%;
    bottom: calc(1rem + env(safe-area-inset-bottom));
    translate: -50% 0;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--bg-soft);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    white-space: nowrap;
  }
</style>
