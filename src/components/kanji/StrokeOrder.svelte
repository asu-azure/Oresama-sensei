<script lang="ts">
  // KanjiVG stroke paths (109×109) drawn one by one with stroke-dashoffset.
  // Stroke order is the content here, not decoration: under reduced motion the
  // strokes still arrive one at a time, they just don't sweep.
  import Icon from '../shared/Icon.svelte';

  let { strokes }: { strokes: string[] } = $props();

  let paths: SVGPathElement[] = $state([]);
  let run = $state(0);

  $effect(() => {
    void run;
    const els = paths.slice(0, strokes.length).filter(Boolean);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const p of els) {
      const len = p.getTotalLength();
      p.style.transition = 'none';
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    }
    if (els[0]) void els[0].getBoundingClientRect(); // apply before animating
    let delay = 150;
    for (const p of els) {
      const len = p.getTotalLength();
      const dur = Math.max(260, Math.round(len * 7));
      timers.push(
        setTimeout(() => {
          p.style.transition = `stroke-dashoffset ${dur}ms linear`;
          p.style.strokeDashoffset = '0';
        }, delay),
      );
      delay += dur + 110;
    }
    return () => timers.forEach(clearTimeout);
  });
</script>

<div class="so">
  <svg viewBox="0 0 109 109" role="img" aria-label="Stroke order, {strokes.length} strokes">
    <g class="so__guide">
      <line x1="54.5" y1="0" x2="54.5" y2="109" />
      <line x1="0" y1="54.5" x2="109" y2="54.5" />
    </g>
    <g class="so__ghost">
      {#each strokes as d, i (i)}<path {d} />{/each}
    </g>
    <g class="so__ink">
      {#each strokes as d, i (i)}<path {d} bind:this={paths[i]} />{/each}
    </g>
  </svg>
  <button type="button" class="icon-btn so__replay" aria-label="Replay stroke order" onclick={() => run++}>
    <Icon name="replay" />
  </button>
</div>

<style>
  .so {
    position: relative;
    aspect-ratio: 1;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .so__guide {
    stroke: var(--line-strong);
    stroke-width: 0.5;
    stroke-dasharray: 3 4;
  }
  .so__ghost,
  .so__ink {
    fill: none;
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .so__ghost {
    stroke: var(--fg);
    opacity: 0.12;
  }
  .so__ink {
    stroke: var(--fg);
  }
  .so__replay {
    position: absolute;
    right: 0.3rem;
    bottom: 0.3rem;
  }
</style>
