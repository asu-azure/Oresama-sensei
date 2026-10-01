<script lang="ts">
  // The flashcard screen — the one feature v5 is built around.
  //
  // Everything happens in the browser: today's queue is built from Supabase
  // under RLS (lib/review-queue.ts), FSRS schedules the grade here
  // (lib/srs.ts), and the write goes through the persistent outbox
  // (lib/outbox.ts), so a dropped connection never loses a review and the next
  // card never waits on the network.
  import { onMount } from 'svelte';
  import Icon from '../shared/Icon.svelte';
  import Ruby from '../shared/Ruby.svelte';
  import Speak from '../shared/Speak.svelte';
  import Pitch from '../shared/Pitch.svelte';
  import PitchToggle from '../shared/PitchToggle.svelte';
  import Conjugation from '../shared/Conjugation.svelte';
  import KanjiChips from '../shared/KanjiChips.svelte';
  import ItemImage from '../shared/ItemImage.svelte';
  import AskSensei from '../shared/AskSensei.svelte';
  import { sb, requireUser } from '../../lib/supabase';
  import { getStudyPace } from '../../lib/pace';
  import { buildQueue, fetchByIdsInOrder } from '../../lib/review-queue';
  import { studyDayKey } from '../../lib/study-day';
  import { schedule, retrievability, previewIntervals, type Rating } from '../../lib/srs';
  import { masteryLevel } from '../../lib/mastery';
  import { enqueue, flush, pendingCount, pendingItemIds } from '../../lib/outbox';
  import { setDue, bumpDue } from '../../lib/due';
  import { signPaths } from '../../lib/images';
  import { showReading, stripFurigana } from '../../lib/furigana';
  import { posLabel } from '../../lib/conjugation';
  import { sourceLabel } from '../../lib/source';
  import { speak } from '../../lib/speech';
  import { playGrade, playReveal } from '../../lib/sound';
  import { prefs } from '../../lib/prefs.svelte';
  import { arrive, punch } from '../../lib/mv';
  import { bindReviewKeys, REVIEW_SHORTCUTS } from '../../lib/review-keys';
  import { loadSession, saveSession, clearSession, type QueueSummary } from '../../lib/review-session';
  import { ITEM_COLS, type Item } from '../../lib/types';

  /** Cards fetched per load. The daily budget is the real bound; this is a
   *  window, and grading a batch shrinks the budget, so the next load simply
   *  yields the next slice. */
  const BATCH = 30;

  const RATINGS: { rating: Rating; label: string; key: string }[] = [
    { rating: 'again', label: 'Again', key: '1' },
    { rating: 'hard', label: 'Hard', key: '2' },
    { rating: 'good', label: 'Good', key: '3' },
    { rating: 'easy', label: 'Easy', key: '4' },
  ];

  const EMPTY: QueueSummary = {
    plannedToday: 0,
    backlogReviews: 0,
    backlogNew: 0,
    daysToClear: 0,
    nextResetIso: '',
    overBudget: false,
  };

  let phase = $state<'loading' | 'ready' | 'error'>('loading');
  let errorMsg = $state('');
  let mode = $state<'due' | 'ahead' | 'single'>('due');
  let cards = $state<Item[]>([]);
  let index = $state(0);
  let reviewed = $state(0);
  let summary = $state<QueueSummary>(EMPTY);
  let aheadCards = $state<Item[]>([]);
  let dayKey = '';
  let userId = '';

  let revealed = $state(false);
  let showDetails = $state(false);
  let showHelp = $state(false);
  let editingNote = $state(false);
  let noteDraft = $state('');
  let noteError = $state('');
  let parking = $state(false);
  let flash = $state<{ rating: Rating; seq: number } | null>(null);
  let flashSeq = 0;
  /** One grade per card however the input arrives (double-click, key repeat).
   *  Plain variable, not state: it must take effect immediately. */
  let gradeLock = false;

  const card = $derived(phase === 'ready' && index < cards.length ? cards[index] : null);
  const left = $derived(Math.max(0, summary.plannedToday - reviewed));
  const backlog = $derived(summary.backlogReviews + summary.backlogNew);
  const days = $derived(Math.max(1, summary.daysToClear));
  const previews = $derived(card && revealed ? previewIntervals(card) : null);
  const strength = $derived(card ? retrievability(card) : null);
  const mastery = $derived(card ? masteryLevel(card) : null);
  const pos = $derived(card ? posLabel(card.part_of_speech) : null);
  /** Grades spend today's budget only for planned cards. */
  const countsToday = $derived(mode === 'due' && !summary.overBudget);

  // ---------------------------------------------------------------- loading

  async function load(opts: { resume?: boolean } = {}) {
    phase = 'loading';
    resetCardUi();
    try {
      const user = await requireUser();
      userId = user.id;
      const client = sb();
      const pace = await getStudyPace(client, user.id);
      const now = new Date();
      dayKey = studyDayKey(now, pace.timeZone, pace.dayStartHour);
      const params = new URLSearchParams(location.search);
      const itemId = params.get('item');
      const over = params.get('over') === '1';
      aheadCards = [];

      if (itemId) {
        // One word, from the word list's "Review" link. Never saved or resumed,
        // and never touches today's count.
        const { data, error } = await client.from('knowledge_items').select(ITEM_COLS).eq('id', itemId).maybeSingle();
        if (error) throw error;
        mode = 'single';
        cards = data ? [data as unknown as Item] : [];
        index = 0;
        reviewed = 0;
        summary = { ...EMPTY, plannedToday: cards.length };
      } else {
        const saved = opts.resume === false ? null : loadSession(dayKey, over, now.getTime());
        if (saved) {
          mode = saved.mode;
          cards = saved.cards;
          index = saved.index;
          reviewed = saved.reviewed;
          summary = saved.summary;
        } else {
          // Let queued grades land first, so the counts and the queue are true.
          await flush();
          const pending = pendingItemIds();
          const plan = await buildQueue(client, user.id, pace, now, {
            limit: BATCH + pending.size,
            ignoreBudget: over,
          });
          const ids = plan.ids.filter((id) => !pending.has(id)).slice(0, BATCH);
          const rows = await fetchByIdsInOrder<Item>(client, 'knowledge_items', ITEM_COLS, ids);
          // Grades still waiting to sync aren't in review_log yet.
          const planned = Math.max(0, plan.plannedToday.total - pendingCount());
          mode = 'due';
          cards = rows;
          index = 0;
          reviewed = 0;
          summary = {
            plannedToday: over ? rows.length : planned,
            backlogReviews: plan.backlog.reviews,
            backlogNew: plan.backlog.newCards,
            daysToClear: plan.daysToClear,
            nextResetIso: plan.nextResetIso,
            overBudget: over,
          };
          if (!over) setDue(planned, dayKey);

          // Nothing left anywhere (not merely today's budget spent): offer the
          // scheduled cards closest to fading. FSRS handles early reviews.
          if (!rows.length && plan.backlog.reviews === 0 && plan.backlog.newCards === 0) {
            const { data } = await client
              .from('knowledge_items')
              .select(ITEM_COLS)
              .eq('user_id', user.id)
              .gt('srs_reps', 0)
              .eq('srs_suspended', false)
              .gt('srs_due', now.toISOString())
              .order('srs_due', { ascending: true })
              .limit(BATCH);
            aheadCards = (data ?? []) as unknown as Item[];
          }
          persist();
        }
      }

      // Sign every picture in the batch in one request (cached for ItemImage).
      void signPaths(cards.slice(index).map((c) => c.image_path ?? '')).catch(() => {});
      phase = 'ready';
    } catch (e) {
      console.error(e);
      errorMsg = navigator.onLine ? "Couldn't load your cards." : "You're offline — your cards need a connection to load.";
      phase = 'error';
    }
  }

  function persist() {
    if (mode === 'single') return;
    if (!cards.length || index >= cards.length) {
      clearSession();
      return;
    }
    saveSession({
      v: 3,
      savedAt: Date.now(),
      mode: mode === 'ahead' ? 'ahead' : 'due',
      dayKey,
      cards: $state.snapshot(cards) as Item[],
      index,
      reviewed,
      summary: $state.snapshot(summary),
    });
  }

  function startAhead() {
    mode = 'ahead';
    cards = aheadCards;
    aheadCards = [];
    index = 0;
    reviewed = 0;
    summary = { ...EMPTY, plannedToday: cards.length };
    void signPaths(cards.map((c) => c.image_path ?? '')).catch(() => {});
    persist();
  }

  // ---------------------------------------------------------------- the card

  function resetCardUi() {
    revealed = false;
    showDetails = false;
    editingNote = false;
    noteError = '';
  }

  function reveal() {
    if (!card || revealed) return;
    gradeLock = false;
    revealed = true;
    playReveal();
  }

  function advance(graded: boolean) {
    if (graded) reviewed += 1;
    index += 1;
    resetCardUi();
    persist();
  }

  function grade(rating: Rating) {
    const c = card;
    if (!c || !revealed || gradeLock) return;
    gradeLock = true;

    const now = new Date();
    const next = schedule(c, rating, now);
    const before = retrievability(c, now); // 0–100, or null on a first review
    enqueue({
      itemId: c.id,
      update: { ...next, last_seen: now.toISOString() },
      log: {
        user_id: userId,
        item_id: c.id,
        rating,
        reviewed_at: now.toISOString(),
        // Only a real previous REVIEW counts; null on a first review.
        elapsed_days: c.srs_last_review ? (now.getTime() - Date.parse(c.srs_last_review)) / 86_400_000 : null,
        retrievability: before === null ? null : before / 100,
        // NULL here is how review-queue.ts counts "new cards introduced today".
        stability_before: c.srs_stability ?? null,
        stability_after: next.srs_stability,
        difficulty_after: next.srs_difficulty,
        state_after: next.srs_state,
        interval_after: next.srs_interval,
      },
    });

    // Every grade spends one unit of today's budget — an "again" included,
    // because the server counts review_log rows, relearning ones too.
    if (countsToday) bumpDue(-1);
    playGrade();
    const seq = ++flashSeq;
    flash = { rating, seq };
    setTimeout(() => {
      if (flash?.seq === seq) flash = null;
    }, 700);
    advance(true);
  }

  /** Stop reviewing this word for good (it stays in the word list). Not a
   *  grade: nothing goes to review_log, but it does leave today's plan. */
  async function park() {
    const c = card;
    if (!c || parking || gradeLock) return;
    parking = true;
    const { error } = await sb().from('knowledge_items').update({ srs_suspended: true }).eq('id', c.id);
    parking = false;
    if (error) return;
    if (countsToday) {
      bumpDue(-1);
      summary.plannedToday = Math.max(reviewed, summary.plannedToday - 1);
    }
    advance(false);
  }

  function openNote() {
    if (!card || !revealed) return;
    noteDraft = card.personal_note ?? '';
    noteError = '';
    editingNote = true;
  }

  async function saveNote() {
    const c = card;
    if (!c) return;
    const value = noteDraft.trim() || null;
    const { error } = await sb().from('knowledge_items').update({ personal_note: value }).eq('id', c.id);
    if (error) {
      noteError = "Couldn't save the note — try again.";
      return;
    }
    c.personal_note = value;
    editingNote = false;
    persist();
  }

  /** Ask Sensei's "Save to note": append the reply under whatever is there
   *  (read fresh, in case another device wrote a note meanwhile). */
  async function appendToNote(itemId: string, content: string): Promise<boolean> {
    const client = sb();
    const { data, error: readErr } = await client
      .from('knowledge_items')
      .select('personal_note')
      .eq('id', itemId)
      .maybeSingle();
    if (readErr) return false;
    const existing = (data?.personal_note ?? '').trim();
    const next = existing ? `${existing}\n\n---\n\n${content.trim()}` : content.trim();
    const { error } = await client.from('knowledge_items').update({ personal_note: next }).eq('id', itemId);
    if (error) return false;
    const c = cards.find((x) => x.id === itemId);
    if (c) c.personal_note = next;
    persist();
    return true;
  }

  function sayCard() {
    if (card) void speak(stripFurigana(card.reading || card.term));
  }

  async function continueBatch() {
    clearSession();
    await load({ resume: false });
  }

  onMount(() => {
    void load();
    return bindReviewKeys(() => ({
      reveal: () => (revealed ? grade('good') : reveal()),
      again: () => grade('again'),
      hard: () => grade('hard'),
      good: () => grade('good'),
      easy: () => grade('easy'),
      speak: sayCard,
      details: () => card && (showDetails = !showDetails),
      note: openNote,
      help: () => (showHelp = !showHelp),
      escape: () => {
        if (editingNote) editingNote = false;
        else if (showHelp) showHelp = false;
        else (document.activeElement as HTMLElement | null)?.blur();
      },
    }));
  });

  const FLASH: Record<Rating, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
</script>

<div class="rv">
  {#if phase === 'loading'}
    <div class="rv__state">
      <span class="spin"></span>
      <p class="mono">Shuffling today's cards</p>
    </div>
  {:else if phase === 'error'}
    <div class="rv__state">
      <p class="serif rv__big">{errorMsg}</p>
      <button type="button" class="btn" onclick={() => load()}>Try again</button>
    </div>
  {:else if !cards.length}
    <!-- An empty batch means two very different things; saying "all caught up"
         while a backlog waits would be a lie. -->
    {@const spent = mode === 'due' && backlog > 0}
    <div class="rv__state">
      <p class="mono">{spent ? '今日 · done' : '今日 · clear'}</p>
      <h1 class="serif rv__big" use:arrive>{spent ? "Today's done." : 'Nothing due right now.'}</h1>
      <p class="dim rv__copy">
        {#if spent}
          You've finished today's plan. {backlog.toLocaleString()} still waiting — about {days}
          {days === 1 ? 'day' : 'days'} at this pace. Come back tomorrow and it keeps shrinking.
        {:else}
          You're all caught up. New words join as you add them; reviewed ones come back when they're due.
        {/if}
      </p>
      <div class="rv__actions">
        {#if spent}
          <a class="btn" href="/words" data-astro-prefetch>Your words</a>
          <a class="quiet" href="/?over=1">Study beyond today's plan</a>
        {:else}
          {#if aheadCards.length}
            <button type="button" class="btn btn--lead" onclick={startAhead}>
              <Icon name="forward" /> Study ahead · {aheadCards.length}
            </button>
          {/if}
          <a class="btn" class:btn--lead={!aheadCards.length} href="/words" data-astro-prefetch>Add a word</a>
        {/if}
      </div>
      {#if !spent && aheadCards.length}
        <p class="faint rv__small">Not due yet — these are the ones closest to fading.</p>
      {/if}
    </div>
  {:else if index >= cards.length}
    {@const dayDone = mode === 'due' && left === 0}
    <div class="rv__state">
      <p class="mono">{reviewed} {reviewed === 1 ? 'card' : 'cards'} reviewed</p>
      <h1 class="serif rv__big" use:arrive>
        {mode === 'single' ? 'Done.' : mode === 'ahead' ? 'Ahead of schedule.' : dayDone ? "Today's done." : 'Batch done.'}
      </h1>
      <p class="dim rv__copy">
        {#if mode === 'ahead'}Nice — you got ahead of the schedule.
        {:else if mode === 'single'}That word is rescheduled.
        {:else if left > 0}{left} left in today's plan.
        {:else}That's the whole plan for today.{/if}
      </p>
      {#if dayDone && backlog > 0}
        <!-- Context, not a demand: a finite pile with a date on it. -->
        <p class="faint rv__small">
          {backlog.toLocaleString()} still waiting — about {days}
          {days === 1 ? 'day' : 'days'} at this pace. Nothing is lost by stopping here.
        </p>
      {/if}
      <div class="rv__actions">
        {#if mode === 'single'}
          <a class="btn btn--lead" href="/words" data-vt="back">Back to your words</a>
          <a class="btn" href="/" onclick={() => clearSession()}>Today's review</a>
        {:else if mode === 'due' && left > 0}
          <button type="button" class="btn btn--lead" onclick={continueBatch}>Continue · {left} left today</button>
          <a class="btn" href="/words" onclick={() => clearSession()}>Your words</a>
        {:else}
          <a class="btn btn--lead" href="/words" onclick={() => clearSession()}>Your words</a>
          {#if dayDone && backlog > 0}
            <a class="quiet" href="/?over=1" onclick={() => clearSession()}>Study beyond today's plan</a>
          {/if}
        {/if}
      </div>
    </div>
  {:else if card}
    <div class="rv__meta">
      <p class="mono">
        {#if mode === 'single'}One word{:else if mode === 'ahead'}Ahead{:else}Review{/if}
        · {index + 1} / {cards.length}
        {#if countsToday}<span class="rv__left">· {left} left today</span>{/if}
      </p>
      <div class="rv__tools">
        <PitchToggle legend={false} />
        <button type="button" class="icon-btn kbd-only" aria-label="Keyboard shortcuts" aria-pressed={showHelp} onclick={() => (showHelp = !showHelp)}>
          <Icon name="keyboard" />
        </button>
      </div>
    </div>
    {#if countsToday && backlog > 0}
      <p class="faint rv__small rv__pile">
        {backlog.toLocaleString()} more waiting · about {days} {days === 1 ? 'day' : 'days'} at this pace
      </p>
    {/if}
    {#if summary.overBudget}<p class="rv__small rv__over">Studying beyond today's plan.</p>{/if}
    {#if mode === 'ahead'}<p class="rv__small rv__over">Reviewing ahead — these aren't due yet.</p>{/if}

    <div class="rv__bar" aria-hidden="true"><span style="width: {(index / cards.length) * 100}%"></span></div>

    {#if showHelp}
      <div class="rv__help panel kbd-only">
        {#each REVIEW_SHORTCUTS as s (s.keys)}
          <span class="kbd">{s.keys}</span><span class="dim">{s.what}</span>
        {/each}
      </div>
    {/if}

    {#key card.id}
      <article class="sheet spread--paper" aria-live="polite">
        <span class="crop crop--tl"></span><span class="crop crop--tr"></span>
        <span class="crop crop--bl"></span><span class="crop crop--br"></span>

        <div class="chips sheet__chips">
          <span class="chip">{card.type}</span>
          {#if card.jlpt_level}<span class="chip chip--accent">{card.jlpt_level}</span>{/if}
          {#if revealed && pos}<span class="chip">{pos}</span>{/if}
          <button type="button" class="chip" aria-pressed={showDetails} onclick={() => (showDetails = !showDetails)}>
            <Icon name="info" /> details
          </button>
        </div>

        {#if showDetails}
          <div class="sheet__details mv-rise">
            <p><span class="mono">From</span> {sourceLabel(card.source_type)}</p>
            <p>
              <span class="mono">History</span> reviewed {card.srs_reps ?? 0}× · seen {card.times_seen ?? 0}× while studying
            </p>
            <p class="sheet__strength">
              <span class="dot" style="--c: {mastery?.color}"></span>
              {strength != null ? `Memory strength ~${strength}% · ${mastery?.label}` : 'New — not scheduled yet'}
            </p>
            <!-- Words arrived automatically from chats and photographed pages, so
                 some were never worth studying. Parking takes one out of every
                 queue for good; it stays in the word list and can come back. -->
            <button type="button" class="quiet" disabled={parking} onclick={park}>
              <Icon name="archive" /> {parking ? 'Parking…' : 'Park this word (stop reviewing it)'}
            </button>
          </div>
        {/if}

        <div class="sheet__term jp-serif" use:arrive><Ruby text={card.term} /></div>
        <div class="sheet__say"><Speak text={stripFurigana(card.reading || card.term)} /></div>

        {#if revealed}
          <div class="sheet__answer mv-rise">
            {#if showReading(card.term, card.reading)}
              <p class="sheet__reading">
                {#if prefs.pitch}<Pitch term={card.term} reading={card.reading} />{:else}<span class="jp">{card.reading}</span>{/if}
              </p>
            {/if}
            {#if card.meaning}<p class="sheet__meaning serif">{card.meaning}</p>{/if}
            {#if card.example}<p class="sheet__example jp"><Ruby text={card.example} /></p>{/if}

            <ItemImage
              itemId={card.id}
              term={card.term}
              meaning={card.meaning}
              reading={card.reading}
              path={card.image_path}
              source={card.image_source}
              onchange={(p, s) => {
                card.image_path = p;
                card.image_source = s;
                persist();
              }}
            />

            <KanjiChips term={card.term} from="review" />
            <Conjugation term={card.term} reading={card.reading} pos={card.part_of_speech} />

            {#if editingNote}
              <div class="sheet__note">
                <!-- svelte-ignore a11y_autofocus -->
                <textarea
                  class="input"
                  rows="3"
                  bind:value={noteDraft}
                  autofocus
                  placeholder="Your own note — a mnemonic, a nuance, an example…"
                ></textarea>
                {#if noteError}<p class="sheet__err">{noteError}</p>{/if}
                <div class="sheet__noteActions">
                  <button type="button" class="quiet" onclick={() => (editingNote = false)}>Cancel</button>
                  <button type="button" class="btn btn--sm btn--lead" onclick={saveNote}>Save note</button>
                </div>
              </div>
            {:else if card.personal_note}
              <div class="sheet__note">
                <div class="sheet__noteHead">
                  <span class="mono">My note</span>
                  <button type="button" class="quiet" onclick={openNote}><Icon name="pencil" /> Edit</button>
                </div>
                <p class="sheet__noteText">{card.personal_note}</p>
              </div>
            {:else}
              <button type="button" class="quiet sheet__addNote" onclick={openNote}><Icon name="pencil" /> Add a note</button>
            {/if}
          </div>
        {:else}
          <div class="sheet__reveal">
            <button type="button" class="btn btn--lead btn--lg" onclick={reveal}>Show answer</button>
            <p class="kbd-only faint rv__small">press <span class="kbd">Space</span></p>
          </div>
        {/if}
      </article>
    {/key}

    {#if revealed}
      <div class="rate">
        {#each RATINGS as r (r.rating)}
          <button
            type="button"
            class="rate__btn"
            style="--rc: var(--r-{r.rating})"
            aria-label="{r.label}{previews ? ` — next in ${previews[r.rating]}` : ''}"
            aria-keyshortcuts={r.key}
            onpointerdown={(e) => punch(e.currentTarget)}
            onclick={() => grade(r.rating)}
          >
            <span class="rate__key kbd-only">{r.key}</span>
            <span class="rate__label">{r.label}</span>
            {#if previews}<span class="rate__eta">{previews[r.rating]}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    <AskSensei
      context={{
        kind: 'vocab',
        item: {
          type: card.type,
          term: card.term,
          reading: card.reading,
          meaning: card.meaning,
          example: card.example,
          jlpt_level: card.jlpt_level,
        },
      }}
      contextKey={`card-${card.id}`}
      suggestions={['Explain this word in depth.', 'Give me another example sentence.', "What's an easy way to remember this?"]}
      onsavetonote={(content) => appendToNote(card.id, content)}
    />
  {/if}

  {#if flash}
    {#key flash.seq}
      <div class="flash" style="--fc: var(--r-{flash.rating})" aria-hidden="true">
        <span class="flash__label mono">{FLASH[flash.rating]}</span>
        <span class="flash__line"></span>
      </div>
    {/key}
  {/if}
</div>

<style>
  .rv {
    position: relative;
  }
  .rv__state {
    min-height: 55svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.9rem;
    text-align: center;
  }
  .rv__big {
    font-size: clamp(2rem, 7vw, 3rem);
    line-height: 1.05;
    font-weight: 400;
    letter-spacing: -0.015em;
  }
  .rv__copy {
    max-width: 26rem;
  }
  .rv__small {
    font-size: 0.78rem;
  }
  .rv__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.6rem 1rem;
    margin-top: 0.4rem;
  }

  .rv__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .rv__left {
    color: var(--fg);
  }
  .rv__tools {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .rv__pile {
    margin-top: 0.3rem;
  }
  .rv__over {
    margin-top: 0.3rem;
    color: var(--accent-text);
  }
  .rv__bar {
    height: 2px;
    margin: 0.8rem 0 1.1rem;
    background: var(--line);
    border-radius: 2px;
    overflow: hidden;
  }
  .rv__bar span {
    display: block;
    height: 100%;
    background: var(--accent-text);
    transition: width 0.3s var(--ease);
  }
  .rv__help {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.45rem 0.9rem;
    align-items: center;
    padding: 0.9rem 1rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }

  /* The card is a cream proof sheet, crop marks and all. */
  .sheet {
    position: relative;
    padding: clamp(1.6rem, 6vw, 2.6rem) clamp(1.1rem, 5vw, 2.2rem) clamp(1.6rem, 5vw, 2.2rem);
    border-radius: 4px;
    background: var(--paper-bg-soft);
    border: 1px solid var(--line);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 24px 60px -30px rgba(0, 0, 0, 0.6);
    text-align: center;
  }
  .sheet__chips {
    justify-content: center;
  }
  .sheet__chips :global(svg) {
    width: 1.05em;
    height: 1.05em;
  }
  .sheet__details {
    display: grid;
    gap: 0.35rem;
    margin: 1rem auto 0;
    max-width: 26rem;
    padding: 0.8rem 1rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    text-align: left;
    font-size: 0.85rem;
    color: var(--fg-dim);
  }
  .sheet__details .mono {
    font-size: 0.55rem;
    margin-right: 0.4rem;
  }
  .sheet__strength {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .sheet__term {
    margin-top: clamp(1.4rem, 5vh, 2.4rem);
    font-size: clamp(2.4rem, 11vw, 3.6rem);
    font-weight: 600;
    line-height: 1.25;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  .sheet__say {
    display: flex;
    justify-content: center;
    margin-top: 0.3rem;
  }
  .sheet__reveal {
    display: grid;
    justify-items: center;
    gap: 0.7rem;
    margin-top: clamp(1.6rem, 5vh, 2.6rem);
  }
  .sheet__answer {
    display: grid;
    gap: 0.9rem;
    margin-top: 1.4rem;
    padding-top: 1.4rem;
    border-top: 1px solid var(--line);
    text-align: left;
  }
  .sheet__reading {
    font-size: 1.25rem;
    color: var(--fg-dim);
  }
  .sheet__meaning {
    font-size: 1.3rem;
    line-height: 1.35;
  }
  .sheet__example {
    font-size: 1rem;
    line-height: 2;
    color: var(--fg-dim);
  }
  .sheet__note {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .sheet__noteHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sheet__noteHead .mono {
    font-size: 0.56rem;
  }
  .sheet__noteText {
    white-space: pre-wrap;
    font-size: 0.92rem;
  }
  .sheet__noteActions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
  }
  .sheet__err {
    font-size: 0.78rem;
    color: var(--r-again);
  }
  .sheet__addNote {
    justify-self: start;
  }

  /* Ratings: four colours, the interval each would give underneath. */
  .rate {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .rate__btn {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    padding: 0.75rem 0.25rem 0.65rem;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--rc) 60%, transparent);
    background: color-mix(in srgb, var(--rc) 18%, transparent);
    color: var(--fg);
    transition:
      background 0.2s var(--ease),
      translate 0.2s var(--ease);
  }
  @media (hover: hover) {
    .rate__btn:hover {
      background: var(--rc);
      color: #fff;
      translate: 0 -2px;
    }
  }
  .rate__btn:active {
    background: var(--rc);
    color: #fff;
  }
  .rate__label {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .rate__eta {
    font-size: 0.72rem;
    opacity: 0.75;
  }
  .rate__key {
    position: absolute;
    top: 0.3rem;
    left: 0.45rem;
    font-family: var(--font-mono);
    font-size: 0.55rem;
    opacity: 0.55;
  }

  /* On-grade flash: a streak at the bottom of the screen, coloured by how it went. */
  .flash {
    position: fixed;
    left: 50%;
    bottom: calc(1.4rem + env(safe-area-inset-bottom));
    z-index: 65;
    translate: -50% 0;
    display: grid;
    justify-items: center;
    gap: 0.4rem;
    pointer-events: none;
    animation: flash 0.7s var(--ease) both;
  }
  .flash__label {
    color: var(--fc);
  }
  .flash__line {
    width: min(16rem, 70vw);
    height: 3px;
    border-radius: 3px;
    background: linear-gradient(90deg, transparent, var(--fc) 22%, color-mix(in srgb, var(--fc) 45%, #fff) 50%, var(--fc) 78%, transparent);
    box-shadow: 0 0 14px color-mix(in srgb, var(--fc) 70%, transparent);
  }
  @keyframes flash {
    0% {
      opacity: 0;
      scale: 0.4 1;
      translate: -50% 8px;
    }
    25% {
      opacity: 1;
      scale: 1 1;
      translate: -50% 0;
    }
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
