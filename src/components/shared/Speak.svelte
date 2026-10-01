<script lang="ts">
  import Icon from './Icon.svelte';
  import { speak, canSpeak } from '../../lib/speech';

  let { text, label = 'Say it' }: { text: string; label?: string } = $props();
  let speaking = $state(false);

  async function say(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    speaking = true;
    await speak(text);
    speaking = false;
  }
</script>

{#if canSpeak()}
  <button type="button" class="icon-btn" onclick={say} aria-label={label} title={label} aria-pressed={speaking}>
    <Icon name="speak" />
  </button>
{/if}
