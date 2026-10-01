<script lang="ts">
  // One word, opened in the list: reading (with pitch), meaning, example,
  // picture, kanji, note, and the Review / Park controls.
  import Icon from '../shared/Icon.svelte';
  import Ruby from '../shared/Ruby.svelte';
  import Speak from '../shared/Speak.svelte';
  import Pitch from '../shared/Pitch.svelte';
  import KanjiChips from '../shared/KanjiChips.svelte';
  import ItemImage from '../shared/ItemImage.svelte';
  import Conjugation from '../shared/Conjugation.svelte';
  import { sb } from '../../lib/supabase';
  import { prefs } from '../../lib/prefs.svelte';
  import { showReading, stripFurigana } from '../../lib/furigana';
  import { masteryLevel } from '../../lib/mastery';
  import { retrievability } from '../../lib/srs';
  import { sourceLabel } from '../../lib/source';
  import type { Item } from '../../lib/types';

  // Bindable: parking, notes and pictures write straight back to the list's row.
  let { item = $bindable() }: { item: Item } = $props();

  const m = $derived(masteryLevel(item));
  const strength = $derived(retrievability(item));
  let parking = $state(false);
  let editing = $state(false);
  let draft = $state('');
  let noteError = $state('');

  async function togglePark() {
    if (parking) return;
    parking = true;
    const next = !item.srs_suspended;
    const { error } = await sb().from('knowledge_items').update({ srs_suspended: next }).eq('id', item.id);
    parking = false;
    if (!error) item.srs_suspended = next;
  }

  async function saveNote() {
    const value = draft.trim() || null;
    const { error } = await sb().from('knowledge_items').update({ personal_note: value }).eq('id', item.id);
    if (error) {
      noteError = "Couldn't save the note.";
      return;
    }
    item.personal_note = value;
    editing = false;
  }
</script>

<div class="wd mv-rise">
  <div class="wd__top">
    <div class="wd__text">
      {#if showReading(item.term, item.reading)}
        <p class="wd__reading">
          {#if prefs.pitch}<Pitch term={item.term} reading={item.reading ?? ''} />{:else}<span class="jp">{item.reading}</span>{/if}
        </p>
      {/if}
      {#if item.meaning}<p class="wd__meaning">{item.meaning}</p>{/if}
      {#if item.example}<p class="wd__example jp"><Ruby text={item.example} /></p>{/if}
    </div>
    <Speak text={stripFurigana(item.reading || item.term)} />
  </div>

  <div class="chips">
    <span class="chip">{item.type}</span>
    {#if item.jlpt_level}<span class="chip chip--accent">{item.jlpt_level}</span>{/if}
    <span class="chip"><span class="dot" style="--c: {m.color}"></span>{m.label}{strength != null ? ` · ${strength}%` : ''}</span>
    <span class="chip">{sourceLabel(item.source_type)}</span>
    {#if (item.times_seen ?? 0) > 1}<span class="chip">seen {item.times_seen}×</span>{/if}
  </div>

  <KanjiChips term={item.term} from="words" />
  <Conjugation term={item.term} reading={item.reading} pos={item.part_of_speech} />

  <ItemImage
    itemId={item.id}
    term={item.term}
    meaning={item.meaning}
    reading={item.reading}
    path={item.image_path}
    source={item.image_source}
    onchange={(p, s) => {
      item.image_path = p;
      item.image_source = s;
    }}
  />

  {#if editing}
    <div class="wd__note">
      <!-- svelte-ignore a11y_autofocus -->
      <textarea class="input" rows="3" bind:value={draft} autofocus placeholder="A mnemonic, a nuance, an example…"></textarea>
      {#if noteError}<p class="wd__err">{noteError}</p>{/if}
      <div class="wd__noteActions">
        <button type="button" class="quiet" onclick={() => (editing = false)}>Cancel</button>
        <button type="button" class="btn btn--sm btn--lead" onclick={saveNote}>Save note</button>
      </div>
    </div>
  {:else if item.personal_note}
    <div class="wd__note">
      <span class="mono">My note</span>
      <p class="wd__noteText">{item.personal_note}</p>
    </div>
  {/if}

  <div class="wd__actions">
    <a class="btn btn--sm" href="/?item={item.id}">Review this word</a>
    <button
      type="button"
      class="quiet"
      onclick={() => {
        draft = item.personal_note ?? '';
        noteError = '';
        editing = true;
      }}><Icon name="pencil" /> {item.personal_note ? 'Edit note' : 'Add a note'}</button
    >
    <button
      type="button"
      class="quiet wd__park"
      class:on={item.srs_suspended}
      disabled={parking}
      title={item.srs_suspended ? 'Bring this word back into review' : 'Stop reviewing this word (it stays here)'}
      onclick={togglePark}
    >
      <Icon name="archive" />
      {item.srs_suspended ? 'Parked · bring back' : 'Park'}
    </button>
  </div>
</div>

<style>
  .wd {
    display: grid;
    gap: 0.85rem;
    padding: 0.2rem 0.9rem 1rem 2.05rem;
  }
  .wd__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.6rem;
  }
  .wd__text {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
  }
  .wd__reading {
    font-size: 1.05rem;
    color: var(--fg-dim);
  }
  .wd__meaning {
    font-family: var(--font-serif);
    font-size: 1.1rem;
    line-height: 1.35;
  }
  .wd__example {
    line-height: 2;
    color: var(--fg-dim);
  }
  .wd__note {
    display: grid;
    gap: 0.45rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .wd__note .mono {
    font-size: 0.55rem;
  }
  .wd__noteText {
    white-space: pre-wrap;
    font-size: 0.9rem;
  }
  .wd__noteActions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
  }
  .wd__err {
    font-size: 0.78rem;
    color: var(--r-again);
  }
  .wd__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.2rem;
  }
  .wd__park.on {
    color: var(--amber);
  }
  @media (max-width: 480px) {
    .wd {
      padding-left: 0.9rem;
    }
  }
</style>
