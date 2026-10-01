<script lang="ts">
  // Quick-add: type anything (Japanese, rōmaji, English, a whole sentence),
  // Sensei drafts the card, you check it, it's saved. Two steps on purpose —
  // the draft writes nothing until you press Save.
  import Icon from '../shared/Icon.svelte';
  import Ruby from '../shared/Ruby.svelte';
  import { api } from '../../lib/supabase';
  import { playTap } from '../../lib/sound';
  import type { DraftItem, Item } from '../../lib/types';

  let { onadded, onclose }: { onadded: (item: Item, existed: boolean) => void; onclose: () => void } = $props();

  const BLANK: DraftItem = {
    type: 'vocab',
    term: '',
    reading: '',
    meaning: '',
    example: '',
    jlpt_level: '',
    part_of_speech: '',
    notes: '',
  };

  let text = $state('');
  let draft = $state<DraftItem | null>(null);
  let busy = $state<'draft' | 'save' | null>(null);
  let error = $state('');

  async function makeDraft() {
    const t = text.trim();
    if (!t || busy) return;
    busy = 'draft';
    error = '';
    try {
      const res = await api('/api/draft', { method: 'POST', body: JSON.stringify({ text: t }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.item) throw new Error(j.error || "Couldn't draft that — try rephrasing.");
      draft = { ...BLANK, ...j.item };
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong.';
    } finally {
      busy = null;
    }
  }

  function writeMyself() {
    draft = { ...BLANK, term: text.trim() };
    error = '';
  }

  async function save() {
    if (!draft?.term.trim() || busy) return;
    busy = 'save';
    error = '';
    try {
      const res = await api('/api/words', { method: 'POST', body: JSON.stringify({ item: $state.snapshot(draft) }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.item) throw new Error(j.error || "Couldn't save — try again.");
      playTap();
      onadded(j.item as Item, !!j.existed);
      text = '';
      draft = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong.';
    } finally {
      busy = null;
    }
  }
</script>

<section class="add panel" aria-label="Add a word">
  <header class="add__head">
    <span class="mono">Add a word</span>
    <button type="button" class="icon-btn" aria-label="Close" onclick={onclose}><Icon name="x" /></button>
  </header>

  {#if !draft}
    <form
      class="add__ask"
      onsubmit={(e) => {
        e.preventDefault();
        void makeDraft();
      }}
    >
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="input jp"
        bind:value={text}
        autofocus
        placeholder="食べる · taberu · to eat · or a whole sentence"
        enterkeyhint="go"
        aria-label="Word to add"
      />
      <div class="add__row">
        <button type="submit" class="btn btn--lead" disabled={!text.trim() || !!busy}>
          {#if busy === 'draft'}<span class="spin"></span> Drafting…{:else}<Icon name="sparkle" /> Draft the card{/if}
        </button>
        <button type="button" class="quiet" disabled={!text.trim() || !!busy} onclick={writeMyself}>Fill it in myself</button>
      </div>
      <p class="faint add__hint">Sensei fills in the reading, meaning, an example and the level. You check it before it's saved.</p>
    </form>
  {:else}
    <form
      class="add__form"
      onsubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div class="add__two">
        <label class="field"><span>Word or pattern</span><input class="jp" bind:value={draft.term} required /></label>
        <label class="field"><span>Reading</span><input class="jp" bind:value={draft.reading} /></label>
      </div>
      <label class="field"><span>Meaning</span><input bind:value={draft.meaning} /></label>
      <label class="field">
        <span>Example</span>
        <textarea class="jp" rows="2" bind:value={draft.example}></textarea>
        {#if draft.example}<small class="jp add__preview"><Ruby text={draft.example} /></small>{/if}
      </label>
      <div class="add__three">
        <label class="field">
          <span>Type</span>
          <select bind:value={draft.type}>
            <option value="vocab">vocab</option>
            <option value="grammar">grammar</option>
            <option value="expression">expression</option>
          </select>
        </label>
        <label class="field"><span>JLPT</span><input bind:value={draft.jlpt_level} placeholder="N2" /></label>
        <label class="field"><span>Part of speech</span><input bind:value={draft.part_of_speech} placeholder="godan verb" /></label>
      </div>
      {#if draft.notes}
        <label class="field"><span>Sensei's note</span><textarea rows="2" bind:value={draft.notes}></textarea></label>
      {/if}
      <div class="add__row">
        <button type="submit" class="btn btn--lead" disabled={!draft.term.trim() || !!busy}>
          {#if busy === 'save'}<span class="spin"></span> Saving…{:else}<Icon name="check" /> Save to my words{/if}
        </button>
        <button type="button" class="quiet" disabled={!!busy} onclick={() => (draft = null)}>Start over</button>
      </div>
    </form>
  {/if}

  {#if error}<p class="add__err">{error}</p>{/if}
</section>

<style>
  .add {
    padding: 0.4rem 1rem 1rem;
    margin-bottom: 1.4rem;
  }
  .add__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-right: -0.5rem;
  }
  .add__ask,
  .add__form {
    display: grid;
    gap: 0.8rem;
  }
  .add__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1.1rem;
  }
  .add__hint {
    font-size: 0.78rem;
  }
  .add__two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.7rem;
  }
  .add__three {
    display: grid;
    grid-template-columns: 1.1fr 0.7fr 1.4fr;
    gap: 0.7rem;
  }
  @media (max-width: 480px) {
    .add__two,
    .add__three {
      grid-template-columns: 1fr;
    }
  }
  .add__preview {
    line-height: 2;
    color: var(--fg-dim);
  }
  .add__err {
    margin-top: 0.7rem;
    font-size: 0.82rem;
    color: var(--r-again);
  }
</style>
