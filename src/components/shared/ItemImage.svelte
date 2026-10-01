<script lang="ts">
  // One picture per word (a visual memory aid): shown with a lightbox, and
  // added or changed by Upload / Draw / Find online / Remove. Everything runs
  // in the browser under RLS (lib/images.ts).
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import DrawPad from './DrawPad.svelte';
  import WebImages from './WebImages.svelte';
  import { requireUser } from '../../lib/supabase';
  import { signPaths, setItemImage, removeItemImage, fetchWebImage, creditFor, type WebHit } from '../../lib/images';
  import { stripFurigana } from '../../lib/furigana';
  import { playTap } from '../../lib/sound';

  let {
    itemId,
    term,
    meaning = null,
    reading = null,
    path = null,
    source = null,
    onchange,
  }: {
    itemId: string;
    term: string;
    meaning?: string | null;
    reading?: string | null;
    path?: string | null;
    source?: string | null;
    /** The stored picture changed (so the parent's copy of the row can follow). */
    onchange?: (path: string | null, source: string | null) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let current = $state<{ path: string | null; source: string | null }>({ path, source });
  let url = $state<string | null>(null);
  let menu = $state(false);
  let mode = $state<'draw' | 'web' | 'view' | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  // Sign the stored path (usually already signed in a batch — see signPaths).
  $effect(() => {
    const p = current.path;
    url = null;
    if (!p) return;
    let alive = true;
    signPaths([p]).then((u) => {
      if (alive) url = u[p] ?? null;
    });
    return () => {
      alive = false;
    };
  });

  const suggestions = $derived(
    [...new Set([(meaning ?? '').split(/[;,/]/)[0].trim(), stripFurigana(term), stripFurigana(reading ?? '').trim()])].filter(
      Boolean,
    ),
  );

  async function store(blob: Blob, credit: string | null) {
    busy = true;
    error = null;
    try {
      const user = await requireUser();
      const res = await setItemImage(user.id, itemId, current.path, blob, credit);
      current = { path: res.path, source: credit };
      if (res.url) url = res.url;
      onchange?.(current.path, current.source);
      menu = false;
      mode = null;
      playTap();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong.';
    } finally {
      busy = false;
    }
  }

  async function pickWeb(h: WebHit) {
    busy = true;
    error = null;
    try {
      const blob = await fetchWebImage(h.url);
      await store(blob, creditFor(h));
    } catch (e) {
      error = e instanceof Error ? e.message : "Couldn't fetch that picture.";
      busy = false;
    }
  }

  async function remove() {
    busy = true;
    error = null;
    try {
      await removeItemImage(itemId, current.path);
      current = { path: null, source: null };
      onchange?.(null, null);
      menu = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Couldn't remove it.";
    } finally {
      busy = false;
    }
  }
</script>

<div class="ii">
  <input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    hidden
    onchange={(e) => {
      const f = e.currentTarget.files?.[0];
      e.currentTarget.value = '';
      if (f) void store(f, null);
    }}
  />

  {#if current.path}
    <button type="button" class="ii__pic" onclick={() => (mode = 'view')} aria-label="Open the picture">
      {#if url}<img src={url} alt={stripFurigana(term)} decoding="async" />{:else}<span class="ii__ph"></span>{/if}
    </button>
    {#if current.source}<p class="ii__credit faint" title={current.source}>{current.source}</p>{/if}
    <button type="button" class="quiet" onclick={() => (menu = !menu)} aria-expanded={menu}>
      <Icon name="pencil" /> Change picture
    </button>
  {:else}
    <button type="button" class="ii__add quiet" onclick={() => (menu = !menu)} aria-expanded={menu}>
      {#if busy}<span class="spin"></span>{:else}<Icon name="image" />{/if} Add a picture
    </button>
  {/if}

  {#if menu}
    <div class="chips ii__menu">
      <button type="button" class="chip" disabled={busy} onclick={() => fileInput.click()}><Icon name="upload" /> Upload</button>
      <button type="button" class="chip" disabled={busy} onclick={() => (mode = 'draw')}><Icon name="pencil" /> Draw</button>
      <button type="button" class="chip" disabled={busy} onclick={() => (mode = 'web')}><Icon name="search" /> Find online</button>
      {#if current.path}
        <button type="button" class="chip ii__rm" disabled={busy} onclick={remove}><Icon name="trash" /> Remove</button>
      {/if}
    </div>
  {/if}
  {#if error}<p class="ii__err">{error}</p>{/if}
</div>

{#if mode === 'draw'}
  <DrawPad {busy} onsave={(b) => store(b, null)} onclose={() => (mode = null)} />
{:else if mode === 'web'}
  <WebImages {suggestions} {busy} onpick={pickWeb} onclose={() => (mode = null)} />
{:else if mode === 'view' && url}
  <Modal title={stripFurigana(term)} wide onclose={() => (mode = null)}>
    <img class="ii__full" src={url} alt={stripFurigana(term)} />
    {#if current.source}<p class="ii__credit faint">{current.source}</p>{/if}
  </Modal>
{/if}

<style>
  .ii {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }
  .ii__pic {
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--line);
    cursor: zoom-in;
  }
  .ii__pic img {
    max-height: 11rem;
    width: auto;
    object-fit: contain;
  }
  .ii__ph {
    display: block;
    width: 9rem;
    height: 7rem;
    background: var(--line);
  }
  .ii__credit {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.65rem;
  }
  .ii__add {
    padding: 0.5rem 0.9rem;
    border: 1px dashed var(--line-strong);
    border-radius: 10px;
  }
  .ii__menu {
    justify-content: center;
    margin-top: 0.2rem;
  }
  .ii__menu :global(svg) {
    width: 1.1em;
    height: 1.1em;
  }
  .ii__rm {
    color: var(--r-again);
  }
  .ii__err {
    font-size: 0.75rem;
    color: var(--r-again);
  }
  .ii__full {
    width: 100%;
    border-radius: 8px;
  }
</style>
