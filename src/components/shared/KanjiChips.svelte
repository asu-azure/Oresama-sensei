<script lang="ts">
  // The kanji in a word, each with its main meaning, linking to its page.
  // Data is fetched per JLPT level and cached (lib/kanji.ts).
  import { kanjiGlosses, kanjiHref } from '../../lib/kanji';
  import { stripFurigana } from '../../lib/furigana';

  let { term, from }: { term: string; from?: string } = $props();

  let glosses = $state<{ char: string; meaning: string }[]>([]);
  $effect(() => {
    let alive = true;
    kanjiGlosses(stripFurigana(term))
      .then((g) => {
        if (alive) glosses = g;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  });
</script>

{#if glosses.length}
  <div class="kc">
    <span class="mono">Kanji</span>
    {#each glosses as k (k.char)}
      <a class="kc__k" href={kanjiHref(k.char, from)} data-astro-prefetch>
        <span class="jp-serif kc__c">{k.char}</span>
        {#if k.meaning}<span class="kc__m">{k.meaning}</span>{/if}
      </a>
    {/each}
  </div>
{/if}

<style>
  .kc {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .kc .mono {
    font-size: 0.56rem;
    margin-right: 0.2rem;
  }
  .kc__k {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    transition:
      border-color 0.2s var(--ease),
      background 0.2s var(--ease);
  }
  .kc__k:hover {
    border-color: var(--accent-text);
    background: var(--accent-soft);
  }
  .kc__c {
    font-size: 1.05rem;
  }
  .kc__m {
    font-size: 0.72rem;
    color: var(--fg-dim);
  }
</style>
