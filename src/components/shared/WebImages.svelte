<script lang="ts">
  // Find a picture online (Pixabay, then Openverse — no AI tokens). Keyword
  // chips come from the card itself; the box stays editable.
  import { onMount } from 'svelte';
  import Modal from './Modal.svelte';
  import Icon from './Icon.svelte';
  import { searchWebImages, type WebHit } from '../../lib/images';

  let {
    suggestions,
    busy = false,
    onpick,
    onclose,
  }: {
    suggestions: string[];
    busy?: boolean;
    onpick: (hit: WebHit) => void;
    onclose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let query = $state(suggestions[0] ?? '');
  let active = $state('');
  let results = $state<WebHit[]>([]);
  let source = $state<string | null>(null);
  let loading = $state(false);
  let failed = $state(false);
  let picking = $state<string | null>(null);

  async function run(q: string) {
    const term = q.trim();
    if (!term) return;
    active = term;
    loading = true;
    failed = false;
    try {
      const r = await searchWebImages(term);
      if (active !== term) return; // a newer search started
      results = r.results;
      source = r.source;
    } catch {
      results = [];
      failed = true;
    } finally {
      if (active === term) loading = false;
    }
  }

  function pick(h: WebHit) {
    picking = h.id;
    onpick(h);
  }

  // Search the first keyword straight away (once — not on every keystroke).
  onMount(() => void run(query));

  $effect(() => {
    if (!busy) picking = null;
  });
</script>

<Modal title="Find a picture" wide {onclose}>
  <form
    class="search"
    onsubmit={(e) => {
      e.preventDefault();
      void run(query);
    }}
  >
    <Icon name="search" />
    <input class="input" bind:value={query} placeholder="Search pictures…" enterkeyhint="search" />
  </form>

  {#if suggestions.length > 1}
    <div class="chips sugg">
      {#each suggestions as s (s)}
        <button
          type="button"
          class="chip"
          aria-pressed={active === s}
          disabled={loading}
          onclick={() => {
            query = s;
            void run(s);
          }}><span class="jp">{s}</span></button
        >
      {/each}
    </div>
  {/if}

  {#if loading && !results.length}
    <p class="msg"><span class="spin"></span></p>
  {:else if !results.length}
    <p class="msg dim">{failed ? "Search didn't work — try again." : 'No pictures for that — try another word.'}</p>
  {:else}
    <div class="grid" class:dimmed={loading}>
      {#each results as h (h.id)}
        <button
          type="button"
          class="hit"
          title={[h.title, h.license].filter(Boolean).join(' · ')}
          disabled={busy || picking !== null}
          onclick={() => pick(h)}
        >
          <img src={h.thumb} alt={h.title || 'picture result'} loading="lazy" decoding="async" />
          {#if picking === h.id}<span class="hit__busy"><span class="spin"></span></span>{/if}
        </button>
      {/each}
    </div>
  {/if}

  <p class="credit faint">
    {source === 'pixabay'
      ? 'Pictures from Pixabay.'
      : source === 'openverse'
        ? 'Pictures from Openverse (CC-licensed).'
        : 'Searches Pixabay, then Openverse.'}
    The one you pick is saved with its credit, for your own study.
  </p>
</Modal>

<style>
  .sugg {
    margin-top: 0.7rem;
  }
  .msg {
    padding: 2.5rem 0;
    text-align: center;
    font-size: 0.85rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.45rem;
    margin-top: 0.9rem;
    transition: opacity 0.2s var(--ease);
  }
  .grid.dimmed {
    opacity: 0.5;
  }
  .hit {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--line);
  }
  .hit img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hit:disabled {
    opacity: 0.6;
  }
  .hit:hover:not(:disabled) {
    outline: 1.5px solid var(--accent-text);
  }
  .hit__busy {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
  }
  .credit {
    margin-top: 0.9rem;
    font-size: 0.68rem;
    line-height: 1.4;
  }
</style>
