<script lang="ts">
  // The Pitch switch (per device) plus, when on, a one-line legend of the
  // four accent colours and the dictionary credit.
  import { prefs } from '../../lib/prefs.svelte';
  import { ACCENT_TYPE_META, ACCENT_TYPE_ORDER } from '../../lib/pitch';

  let { legend = true }: { legend?: boolean } = $props();
</script>

<div class="pt">
  <button
    type="button"
    class="chip"
    aria-pressed={prefs.pitch}
    onclick={() => prefs.setPitch(!prefs.pitch)}
    title="Pitch-accent marks on readings"
  >
    <span class="pt__a jp">ア</span> Pitch
  </button>
  {#if legend && prefs.pitch}
    <span class="pt__legend">
      {#each ACCENT_TYPE_ORDER as t (t)}
        <span class="pt__item"
          ><span class="dot" style="--c: var(--pitch-{t})"></span><span class="jp">{ACCENT_TYPE_META[t].jp}</span></span
        >
      {/each}
      <a class="faint" href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noreferrer">kanjium</a>
    </span>
  {/if}
</div>

<style>
  .pt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.8rem;
  }
  .pt__a {
    border-top: 2px solid currentColor;
    line-height: 1;
    font-size: 0.8rem;
    letter-spacing: 0;
  }
  .pt__legend {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.7rem;
    font-size: 0.72rem;
    color: var(--fg-dim);
  }
  .pt__item {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
  }
  .pt__legend a {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.08em;
  }
</style>
