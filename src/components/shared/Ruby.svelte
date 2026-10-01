<script lang="ts">
  // A short string with furigana: <ruby> markup and 漢字(かな) notation become
  // real <ruby> elements. Built from data (lib/ruby.ts), never from HTML.
  import { rubySegments } from '../../lib/ruby';

  let { text }: { text: string | null | undefined } = $props();
  const segs = $derived(rubySegments(text));
</script>

{#each segs as s, i (i)}{#if 'text' in s}{s.text}{:else}<ruby>{s.base}<rt>{s.rt}</rt></ruby>{s.tail}{/if}{/each}
