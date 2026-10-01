<script lang="ts">
  // Collapsible conjugation table for a verb/adjective. Offline, no AI; renders
  // nothing for words that don't conjugate.
  import Icon from './Icon.svelte';
  import { conjugate } from '../../lib/conjugation';

  let { term, reading, pos }: { term: string; reading?: string | null; pos?: string | null } = $props();
  const forms = $derived(conjugate(term, reading, pos));
  let open = $state(false);
</script>

{#if forms && forms.length}
  <div class="conj">
    <button type="button" class="conj__head mono" aria-expanded={open} onclick={() => (open = !open)}>
      Conjugation <span class="conj__chev" class:open><Icon name="chevron" /></span>
    </button>
    {#if open}
      <dl class="conj__grid">
        {#each forms as f (f.label)}
          <div>
            <dt class="mono">{f.label}</dt>
            <dd class="jp">{f.form}</dd>
          </div>
        {/each}
      </dl>
    {/if}
  </div>
{/if}

<style>
  .conj {
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .conj__head {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.8rem;
  }
  .conj__chev {
    display: inline-flex;
    transition: rotate 0.2s var(--ease);
  }
  .conj__chev.open {
    rotate: 180deg;
  }
  .conj__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1rem;
    padding: 0.7rem 0.8rem 0.8rem;
    border-top: 1px solid var(--line);
  }
  dt {
    font-size: 0.55rem;
  }
  dd {
    font-size: 0.95rem;
  }
</style>
