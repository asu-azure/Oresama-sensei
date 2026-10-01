<script lang="ts">
  // A kana reading with overline + downstep pitch-accent marks, coloured by
  // accent type (平板/頭高/中高/尾高). Plain reading while the shard loads or
  // when the word isn't in the dictionary.
  import { lookupAccent, pitchPattern, accentType, ACCENT_TYPE_META } from '../../lib/pitch';

  let { term, reading, tag = true }: { term: string; reading: string; tag?: boolean } = $props();

  // How long each mora's line waits behind the previous one (a lit fuse).
  const STEP = 0.09;

  let accent = $state<number | null | undefined>(undefined);
  $effect(() => {
    let alive = true;
    accent = undefined;
    lookupAccent(term, reading).then((a) => {
      if (alive) accent = a;
    });
    return () => {
      alive = false;
    };
  });

  const view = $derived.by(() => {
    if (accent == null) return null;
    const type = accentType(reading, accent);
    return { pattern: pitchPattern(reading, accent), type, meta: ACCENT_TYPE_META[type] };
  });
</script>

{#if view}
  <span
    class="pitch"
    style="--pitch-c: var(--pitch-{view.type})"
    title="pitch accent {accent} ({view.meta.en})"
  >
    <span class="pitch__morae">
      {#each view.pattern as p, i (i)}
        <span class="pitch__mora"
          >{#if p.high}<span class="pitch__line" style="--pitch-delay: {i * STEP}s"></span>{/if}{#if p.drop}<span
              class="pitch__drop"
              style="--pitch-delay: {i * STEP + STEP}s"
            ></span>{/if}{p.mora}</span
        >
      {/each}
    </span>
    {#if tag}<span class="pitch__tag jp">{view.meta.jp}</span>{/if}
  </span>
{:else}
  <span class="jp">{reading}</span>
{/if}
