<script lang="ts">
  // Every saved word, searchable by kanji, kana, rōmaji or English (typo
  // tolerant, all in the browser), filterable by how well it's known, and
  // openable in place. Quick-add sits at the top.
  import { onMount } from 'svelte';
  import Fuse from 'fuse.js';
  import { toHiragana, toRomaji } from 'wanakana';
  import Icon from '../shared/Icon.svelte';
  import Ruby from '../shared/Ruby.svelte';
  import PitchToggle from '../shared/PitchToggle.svelte';
  import AddWord from './AddWord.svelte';
  import WordDetail from './WordDetail.svelte';
  import { sb, requireUser, fetchAllRows } from '../../lib/supabase';
  import { masteryLevel, masteryInfo, MASTERY_ORDER, type MasteryLevel } from '../../lib/mastery';
  import { stripFurigana } from '../../lib/furigana';
  import { arrive } from '../../lib/mv';
  import { ITEM_COLS, type Item } from '../../lib/types';

  const PAGE = 60;
  const TYPES = ['vocab', 'grammar', 'expression'] as const;

  let phase = $state<'loading' | 'ready' | 'error'>('loading');
  let items = $state<Item[]>([]);
  let q = $state('');
  let type = $state<string>('all');
  let jlpt = $state<string>('all');
  let level = $state<MasteryLevel | 'all'>('all');
  let parkedOnly = $state(false);
  let open = $state<string | null>(null);
  let shown = $state(PAGE);
  let adding = $state(false);
  let notice = $state('');
  let sentinel = $state<HTMLDivElement>();

  async function load() {
    phase = 'loading';
    try {
      const user = await requireUser();
      items = await fetchAllRows<Item>((from, to) =>
        sb()
          .from('knowledge_items')
          .select(ITEM_COLS)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: Item[] | null; error: unknown }>,
      );
      phase = 'ready';
    } catch (e) {
      console.error(e);
      phase = 'error';
    }
  }
  onMount(() => {
    void load();
    if (new URLSearchParams(location.search).get('add') === '1') adding = true;
  });

  const levels = $derived(items.map((it) => masteryLevel(it).level));
  const counts = $derived.by(() => {
    const c: Record<string, number> = {};
    for (const l of levels) c[l] = (c[l] ?? 0) + 1;
    return c;
  });
  const parkedCount = $derived(items.filter((it) => it.srs_suspended).length);
  const jlptLevels = $derived(
    [...new Set(items.map((it) => it.jlpt_level?.trim().toUpperCase()).filter((l): l is string => !!l && /^N[1-5]$/.test(l)))].sort().reverse(),
  );

  // Fuzzy index over term / reading / rōmaji / meaning.
  const fuse = $derived(
    new Fuse(
      items.map((it, i) => ({
        i,
        term: stripFurigana(it.term),
        reading: it.reading ?? '',
        romaji: toRomaji(stripFurigana(it.reading || it.term || '')),
        meaning: it.meaning ?? '',
      })),
      { threshold: 0.34, ignoreLocation: true, keys: ['term', 'reading', 'romaji', 'meaning'] },
    ),
  );

  const filtered = $derived.by(() => {
    const query = q.trim();
    let idx: number[];
    if (query) {
      // The raw query AND its kana form, so "taberu", "たべ", "食べる" and
      // "eat" all hit.
      const seen = new Set<number>();
      idx = [];
      for (const term of new Set([query, toHiragana(query)])) {
        for (const r of fuse.search(term, { limit: 200 })) {
          if (!seen.has(r.item.i)) {
            seen.add(r.item.i);
            idx.push(r.item.i);
          }
        }
      }
    } else {
      idx = items.map((_, i) => i);
    }
    return idx.filter((i) => {
      const it = items[i];
      if (type !== 'all' && it.type !== type) return false;
      if (jlpt !== 'all' && it.jlpt_level?.trim().toUpperCase() !== jlpt) return false;
      if (level !== 'all' && levels[i] !== level) return false;
      if (parkedOnly && !it.srs_suspended) return false;
      return true;
    });
  });

  // A new filter starts the list from the top again.
  $effect(() => {
    void q;
    void type;
    void jlpt;
    void level;
    void parkedOnly;
    shown = PAGE;
  });

  // Grow the list as the end comes into view.
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) shown += PAGE;
      },
      { rootMargin: '600px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  });

  function added(item: Item, existed: boolean) {
    adding = false;
    if (existed) {
      notice = `${stripFurigana(item.term)} was already in your words — here it is.`;
    } else {
      items = [item, ...items];
      notice = `Added ${stripFurigana(item.term)}. It joins your reviews as a new card.`;
    }
    q = '';
    type = 'all';
    jlpt = 'all';
    level = 'all';
    parkedOnly = false;
    open = item.id;
    requestAnimationFrame(() => document.getElementById(`w-${item.id}`)?.scrollIntoView({ block: 'center' }));
  }
</script>

<header class="head">
  <p class="mono">語彙 · {items.length.toLocaleString()} saved</p>
  <div class="head__row">
    <h1 class="head__title" use:arrive>Your words</h1>
    {#if !adding}
      <button type="button" class="btn btn--lead" onclick={() => ((adding = true), (notice = ''))}><Icon name="plus" /> Add a word</button>
    {/if}
  </div>
</header>

{#if adding}
  <AddWord onadded={added} onclose={() => (adding = false)} />
{/if}
{#if notice}<p class="notice">{notice}</p>{/if}

{#if phase === 'loading'}
  <p class="state"><span class="spin"></span></p>
{:else if phase === 'error'}
  <div class="state">
    <p class="dim">Couldn't load your words.</p>
    <button type="button" class="btn" onclick={load}>Try again</button>
  </div>
{:else if !items.length}
  <div class="state">
    <p class="serif empty">No words yet.</p>
    <p class="dim">Add your first one above — it becomes a flashcard straight away.</p>
  </div>
{:else}
  <div class="filters">
    <div class="search">
      <Icon name="search" />
      <input class="input" type="search" bind:value={q} placeholder="Kanji, kana, rōmaji or English…" aria-label="Search your words" />
    </div>

    <div class="chips">
      {#each MASTERY_ORDER as l (l)}
        {@const info = masteryInfo(l)}
        <button type="button" class="chip" aria-pressed={level === l} onclick={() => (level = level === l ? 'all' : l)}>
          <span class="dot" style="--c: {info.color}"></span>{info.label}<span class="n">{counts[l] ?? 0}</span>
        </button>
      {/each}
    </div>
    <div class="chips">
      {#each TYPES as t (t)}
        <button type="button" class="chip" aria-pressed={type === t} onclick={() => (type = type === t ? 'all' : t)}>{t}</button>
      {/each}
      {#each jlptLevels as l (l)}
        <button type="button" class="chip" aria-pressed={jlpt === l} onclick={() => (jlpt = jlpt === l ? 'all' : l)}>{l}</button>
      {/each}
      {#if parkedCount}
        <button type="button" class="chip" aria-pressed={parkedOnly} onclick={() => (parkedOnly = !parkedOnly)}>
          <Icon name="archive" /> parked<span class="n">{parkedCount}</span>
        </button>
      {/if}
    </div>
    <div class="filters__foot">
      <p class="mono">{filtered.length.toLocaleString()} shown</p>
      <PitchToggle />
    </div>
  </div>

  <ul class="list">
    {#each filtered.slice(0, shown) as i (items[i].id)}
      {@const it = items[i]}
      {@const isOpen = open === it.id}
      <li class="row" class:open={isOpen} class:parked={it.srs_suspended} id="w-{it.id}">
        <button type="button" class="row__head" aria-expanded={isOpen} onclick={() => (open = isOpen ? null : it.id)}>
          <span class="dot" style="--c: {masteryInfo(levels[i]).color}" title={masteryInfo(levels[i]).label}></span>
          <span class="row__term jp"><Ruby text={it.term} /></span>
          <span class="row__meaning">{it.meaning ?? ''}</span>
          {#if it.image_path}<span class="row__icon" title="Has a picture"><Icon name="image" /></span>{/if}
          <span class="row__chev"><Icon name="chevron" /></span>
        </button>
        {#if isOpen}<WordDetail bind:item={items[i]} />{/if}
      </li>
    {/each}
  </ul>
  {#if !filtered.length}
    <p class="state dim">Nothing matches — try fewer filters.</p>
  {/if}
  {#if shown < filtered.length}<div bind:this={sentinel} class="sentinel"><span class="spin dim"></span></div>{/if}
{/if}

<style>
  .notice {
    margin: -0.4rem 0 1.2rem;
    padding: 0.6rem 0.9rem;
    border-left: 2px solid var(--accent-text);
    font-size: 0.88rem;
    color: var(--fg-dim);
  }
  .state {
    display: grid;
    justify-items: center;
    gap: 0.7rem;
    padding: 3rem 0;
    text-align: center;
  }
  .empty {
    font-size: 1.6rem;
  }
  .filters {
    display: grid;
    gap: 0.7rem;
    margin-bottom: 1rem;
  }
  .filters :global(.chip svg) {
    width: 1.05em;
    height: 1.05em;
  }
  .filters__foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .list {
    list-style: none;
    border-top: 1px solid var(--line);
  }
  .row {
    border-bottom: 1px solid var(--line);
  }
  .row.open {
    background: var(--bg-soft);
  }
  .row.parked .row__term,
  .row.parked .row__meaning {
    opacity: 0.5;
  }
  .row__head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 0.4rem 0.75rem 0.9rem;
    text-align: left;
  }
  .row__term {
    flex-shrink: 0;
    max-width: 55%;
    font-size: 1.1rem;
    line-height: 1.9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row__meaning {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.85rem;
    color: var(--fg-dim);
  }
  .row__icon,
  .row__chev {
    display: inline-flex;
    color: var(--fg-faint);
  }
  .row__chev {
    transition: rotate 0.2s var(--ease);
  }
  .row.open .row__chev {
    rotate: 180deg;
  }
  .sentinel {
    display: flex;
    justify-content: center;
    padding: 1.5rem;
  }
</style>
