<script lang="ts">
  // One kanji (/kanji/view?c=字): stroke order, readings, the parts it's built
  // from, a personal mnemonic (cached per user; its example words are added to
  // your words), and your own words that use it.
  import { onMount } from 'svelte';
  import Icon from '../shared/Icon.svelte';
  import Ruby from '../shared/Ruby.svelte';
  import AskSensei from '../shared/AskSensei.svelte';
  import StrokeOrder from './StrokeOrder.svelte';
  import { sb, requireUser, api } from '../../lib/supabase';
  import { getInfo, getStrokes, levelOf, isKanji, kanjiHref, LEVELS, type KanjiInfo, type KanjiStrokes } from '../../lib/kanji';
  import { masteryLevel } from '../../lib/mastery';
  import { renderMarkdown } from '../../lib/markdown';
  import { speak, canSpeak } from '../../lib/speech';
  import { arrive } from '../../lib/mv';

  type Word = {
    id: string;
    term: string;
    reading: string | null;
    meaning: string | null;
    srs_reps: number | null;
    srs_lapses: number | null;
    srs_stability: number | null;
    srs_difficulty: number | null;
    srs_interval: number | null;
  };
  type Example = { term: string; reading: string; meaning: string; example: string; jlpt_level: string };

  const params = new URLSearchParams(location.search);
  const char = [...(params.get('c') ?? '')][0] ?? '';
  const from = params.get('from');
  const back =
    from === 'review'
      ? { href: '/', label: 'Back to review' }
      : from === 'words'
        ? { href: '/words', label: 'Back to your words' }
        : { href: (LEVELS as string[]).includes(from ?? '') ? `/kanji?level=${from}` : '/kanji', label: 'All kanji' };

  let phase = $state<'loading' | 'ready'>('loading');
  let info = $state<KanjiInfo | null>(null);
  let strokes = $state<KanjiStrokes | null>(null);
  let words = $state<Word[]>([]);
  let mnemonic = $state<string | null>(null);
  let examples = $state<Example[]>([]);
  let learned = $state(false);
  let generating = $state(false);
  let genError = $state('');
  let added = $state(0);
  let userId = '';

  const autoLearned = $derived(words.some((w) => masteryLevel(w).level === 'mastered'));
  const speakText = $derived(info?.kun[0]?.replace(/[.\-]/g, '') || info?.on[0] || char);

  onMount(async () => {
    if (!char) return;
    document.title = `${char} · 俺様先生`;
    const [i, s] = await Promise.all([getInfo(char).catch(() => null), getStrokes(char).catch(() => null)]);
    info = i;
    strokes = s;
    try {
      const user = await requireUser();
      userId = user.id;
      const [w, k] = await Promise.all([
        sb()
          .from('knowledge_items')
          .select('id,term,reading,meaning,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval')
          .eq('user_id', user.id)
          .ilike('term', `%${char}%`)
          .order('created_at', { ascending: false })
          .limit(40),
        sb().from('kanji').select('mnemonic,examples,learned').eq('user_id', user.id).eq('character', char).maybeSingle(),
      ]);
      words = (w.data ?? []) as Word[];
      mnemonic = k.data?.mnemonic ?? null;
      examples = (k.data?.examples as Example[] | null) ?? [];
      learned = !!k.data?.learned;
    } catch (e) {
      console.error(e);
    }
    phase = 'ready';
  });

  async function generate(force: boolean) {
    if (generating) return;
    generating = true;
    genError = '';
    try {
      const res = await api('/api/mnemonic', {
        method: 'POST',
        body: JSON.stringify({
          char,
          force,
          meanings: info?.meanings ?? [],
          readings: [...(info?.on ?? []), ...(info?.kun ?? [])],
          components: (strokes?.components ?? []).map((c) => c.el),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.mnemonic) throw new Error(j.error || "Couldn't write a mnemonic right now.");
      mnemonic = j.mnemonic;
      examples = j.examples ?? [];
      added = j.added ?? 0;
      if (added) {
        // The new example words are in your words now; show them here too.
        const { data } = await sb()
          .from('knowledge_items')
          .select('id,term,reading,meaning,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval')
          .eq('user_id', userId)
          .ilike('term', `%${char}%`)
          .order('created_at', { ascending: false })
          .limit(40);
        words = (data ?? []) as Word[];
      }
    } catch (e) {
      genError = e instanceof Error ? e.message : 'Something went wrong.';
    } finally {
      generating = false;
    }
  }

  async function toggleLearned() {
    const next = !learned;
    learned = next;
    const { error } = await sb()
      .from('kanji')
      .upsert({ user_id: userId, character: char, learned: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,character' });
    if (error) learned = !next;
  }
</script>

<a class="quiet back" href={back.href} data-vt="back"><Icon name="back" /> {back.label}</a>

{#if !char}
  <p class="dim none">No kanji given.</p>
{:else}
  <section class="hero">
    <div class="hero__strokes panel">
      {#if strokes?.strokes.length}
        <StrokeOrder strokes={strokes.strokes} />
      {:else}
        <span class="hero__plain jp-serif">{char}</span>
      {/if}
    </div>

    <div class="hero__facts">
      <div class="hero__row">
        <h1 class="hero__char jp-serif" use:arrive>{char}</h1>
        {#if canSpeak()}
          <button type="button" class="icon-btn" aria-label="Say a reading" onclick={() => speak(speakText)}><Icon name="speak" /></button>
        {/if}
      </div>
      <div class="chips">
        {#if info?.jlpt}<span class="chip chip--accent">{info.jlpt}</span>{/if}
        {#if info?.strokes != null}<span class="chip">{info.strokes} strokes</span>{/if}
        {#if info?.grade != null}<span class="chip">grade {info.grade}</span>{/if}
      </div>
      {#if info?.meanings.length}<p class="hero__meaning serif">{info.meanings.join(', ')}</p>{/if}
      {#if info}
        <dl class="hero__readings">
          {#if info.kun.length}<dt class="mono">kun</dt><dd class="jp">{info.kun.join('、')}</dd>{/if}
          {#if info.on.length}<dt class="mono">on</dt><dd class="jp">{info.on.join('、')}</dd>{/if}
        </dl>
      {:else if phase === 'ready' && !levelOf(char)}
        <p class="dim">Not in the JLPT set, so there's no reading data — your words using it are below.</p>
      {/if}
      {#if phase === 'ready'}
        <button type="button" class="chip learned" aria-pressed={learned || autoLearned} onclick={toggleLearned}>
          <Icon name="check" />
          {learned || autoLearned ? 'Learned' : 'Mark learned'}
        </button>
        {#if autoLearned && !learned}<p class="faint small">Automatically — a word with it is mastered.</p>{/if}
      {/if}
    </div>
  </section>

  {#if strokes?.components.length}
    <section class="block">
      <h2 class="mono">Built from</h2>
      <div class="parts">
        {#each strokes.components as c, i (i)}
          {#if isKanji(c.el) && levelOf(c.el)}
            <a class="part" href={kanjiHref(c.el, from ?? undefined)}>
              <span class="jp-serif">{c.el}</span>{#if c.isRadical}<span class="mono">radical</span>{/if}
            </a>
          {:else}
            <span class="part">
              <span class="jp-serif">{c.el}</span>{#if c.isRadical}<span class="mono">radical</span>{/if}
            </span>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  <section class="block mn panel">
    <h2 class="mono"><Icon name="sparkle" /> Mnemonic</h2>
    {#if mnemonic}
      <div class="prose">{@html renderMarkdown(mnemonic)}</div>
      <div class="mn__foot">
        <button type="button" class="quiet" disabled={generating} onclick={() => generate(true)}>
          {#if generating}<span class="spin"></span> Writing…{:else}<Icon name="replay" /> Write another{/if}
        </button>
        <span class="faint mono mn__model">Gemini Flash</span>
      </div>
    {:else if phase === 'ready'}
      <p class="dim">A vivid memory story built from {char}'s parts, written for you — plus a few example words, added to your words.</p>
      <div class="mn__foot">
        <button type="button" class="btn btn--lead" disabled={generating} onclick={() => generate(false)}>
          {#if generating}<span class="spin"></span> Writing…{:else}<Icon name="sparkle" /> Write a mnemonic{/if}
        </button>
        <span class="faint mono mn__model">Gemini Flash</span>
      </div>
    {/if}
    {#if genError}<p class="err">{genError}</p>{/if}

    {#if examples.length}
      <div class="mn__ex">
        <p class="mono">Example words{added ? ` · ${added} added to your words` : ''}</p>
        <ul>
          {#each examples as w, i (i)}
            <li>
              <span class="jp mn__term">{w.term}</span>
              {#if w.reading}<span class="jp dim">{w.reading}</span>{/if}
              {#if w.meaning}<span class="dim">— {w.meaning}</span>{/if}
              {#if w.example}<p class="jp mn__sent"><Ruby text={w.example} /></p>{/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>

  <section class="block">
    <h2 class="mono">Your words with {char}</h2>
    {#if phase === 'loading'}
      <p><span class="spin dim"></span></p>
    {:else if !words.length}
      <p class="dim">None yet — words you save that use {char} will show here.</p>
    {:else}
      <ul class="words">
        {#each words as w (w.id)}
          {@const m = masteryLevel(w)}
          <li>
            <a href="/?item={w.id}" class="word">
              <span class="dot" style="--c: {m.color}" title={m.label}></span>
              <span class="jp word__term"><Ruby text={w.term} /></span>
              {#if w.reading}<span class="jp dim">{w.reading}</span>{/if}
              {#if w.meaning}<span class="dim word__meaning">{w.meaning}</span>{/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <AskSensei
    context={{ kind: 'kanji', char, meanings: info?.meanings, on: info?.on, kun: info?.kun }}
    contextKey={`kanji-${char}`}
    suggestions={[`How is ${char} used in words?`, 'Give me a way to remember this kanji.', 'Which kanji look similar to this one?']}
  />
{/if}

<style>
  .back {
    margin-bottom: 1.2rem;
  }
  .none {
    padding: 3rem 0;
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 13rem) 1fr;
    gap: clamp(1rem, 4vw, 2rem);
    align-items: start;
  }
  @media (max-width: 520px) {
    .hero {
      grid-template-columns: 1fr;
    }
    .hero__strokes {
      width: min(15rem, 100%);
      margin-inline: auto;
    }
  }
  .hero__strokes {
    padding: 0.4rem;
  }
  .hero__plain {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    font-size: 6rem;
  }
  .hero__facts {
    display: grid;
    gap: 0.7rem;
    justify-items: start;
  }
  .hero__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .hero__char {
    font-size: 3.4rem;
    line-height: 1;
    font-weight: 600;
  }
  .hero__meaning {
    font-size: 1.2rem;
    line-height: 1.35;
  }
  .hero__readings {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.3rem 0.8rem;
    align-items: baseline;
  }
  .hero__readings dd {
    font-size: 1.05rem;
  }
  .learned[aria-pressed='true'] {
    color: var(--m-mastered);
    border-color: color-mix(in srgb, var(--m-mastered) 55%, transparent);
    background: color-mix(in srgb, var(--m-mastered) 12%, transparent);
  }
  .learned :global(svg) {
    width: 1.05em;
    height: 1.05em;
  }
  .small {
    font-size: 0.75rem;
  }
  .block {
    margin-top: 2rem;
    display: grid;
    gap: 0.8rem;
  }
  .block > h2 {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
  }
  .parts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .part {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    font-size: 1.3rem;
  }
  .part .mono {
    font-size: 0.5rem;
    color: var(--accent-text);
  }
  a.part:hover {
    border-color: var(--accent-text);
  }
  .mn {
    padding: 1.1rem 1.2rem;
  }
  .mn__foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
  }
  .mn__model {
    font-size: 0.55rem;
  }
  .mn__ex {
    display: grid;
    gap: 0.6rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--line);
  }
  .mn__ex ul,
  .words {
    list-style: none;
    display: grid;
    gap: 0.6rem;
  }
  .mn__term {
    font-size: 1.1rem;
    margin-right: 0.4rem;
  }
  .mn__sent {
    margin-top: 0.2rem;
    line-height: 2;
    font-size: 0.9rem;
    color: var(--fg-dim);
  }
  .err {
    font-size: 0.82rem;
    color: var(--r-again);
  }
  .words {
    gap: 0;
    border-top: 1px solid var(--line);
  }
  .word {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.6rem 0.4rem;
    border-bottom: 1px solid var(--line);
    transition: background 0.2s var(--ease);
  }
  .word:hover {
    background: var(--bg-soft);
  }
  .word__term {
    font-size: 1.1rem;
    line-height: 1.9;
  }
  .word__meaning {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.85rem;
  }
</style>
