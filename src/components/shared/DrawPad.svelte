<script lang="ts">
  // A small doodle pad — draw a memory aid when no photo fits. Hands back a
  // PNG blob on a white ground (images.ts re-encodes it for storage).
  import { onMount } from 'svelte';
  import Modal from './Modal.svelte';
  import Icon from './Icon.svelte';

  let {
    busy = false,
    onsave,
    onclose,
  }: { busy?: boolean; onsave: (blob: Blob) => void; onclose: () => void } = $props();

  const SIZE = 512;
  const COLORS = ['#16140f', '#2742f0', '#e8a31a', '#f43f5e', '#10b981', '#18c4d6'];

  let canvas: HTMLCanvasElement;
  let color = $state(COLORS[0]);
  let erasing = $state(false);
  let width = $state(6);
  let last: { x: number; y: number } | null = null;

  onMount(clear); // a white ground, so the PNG isn't transparent

  function ctx() {
    return canvas.getContext('2d')!;
  }
  function clear() {
    const c = ctx();
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, SIZE, SIZE);
  }
  function pos(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  }
  function down(e: PointerEvent) {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    last = pos(e);
    move(e); // a tap leaves a dot
  }
  function move(e: PointerEvent) {
    if (!last) return;
    const p = pos(e);
    const c = ctx();
    c.strokeStyle = erasing ? '#ffffff' : color;
    c.lineWidth = erasing ? width * 3 : width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(last.x, last.y);
    c.lineTo(p.x + 0.01, p.y);
    c.stroke();
    last = p;
  }
  function up() {
    last = null;
  }
  function save() {
    canvas.toBlob((b) => b && onsave(b), 'image/png');
  }
</script>

<Modal title="Draw a memory aid" {onclose}>
  <canvas
    bind:this={canvas}
    width={SIZE}
    height={SIZE}
    class="pad"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  ></canvas>

  <div class="tools">
    {#each COLORS as c (c)}
      <button
        type="button"
        class="swatch"
        class:on={color === c && !erasing}
        style="background:{c}"
        aria-label="Colour {c}"
        onclick={() => {
          color = c;
          erasing = false;
        }}
      ></button>
    {/each}
    <input type="range" min="2" max="28" bind:value={width} aria-label="Brush size" />
    <button type="button" class="icon-btn" aria-pressed={erasing} aria-label="Eraser" onclick={() => (erasing = !erasing)}>
      <Icon name="eraser" />
    </button>
    <button type="button" class="icon-btn" aria-label="Clear" onclick={clear}><Icon name="trash" /></button>
  </div>

  <button type="button" class="btn btn--lead save" disabled={busy} onclick={save}>
    {#if busy}<span class="spin"></span>{:else}<Icon name="check" />{/if} Save drawing
  </button>
</Modal>

<style>
  .pad {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 10px;
    border: 1px solid var(--line-strong);
    background: #fff;
    touch-action: none;
    cursor: crosshair;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    margin-top: 0.8rem;
  }
  .swatch {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 2px solid var(--line-strong);
    transition: scale 0.15s var(--ease);
  }
  .swatch.on {
    border-color: var(--fg);
    scale: 1.15;
  }
  input[type='range'] {
    width: 5.5rem;
    accent-color: var(--accent);
  }
  .save {
    width: 100%;
    margin-top: 1rem;
  }
</style>
