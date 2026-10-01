<script lang="ts">
  // A native <dialog> shown modally: the browser handles the focus trap, Esc
  // and the backdrop. Mount it to open it; onclose fires on Esc, the X, or a
  // click on the backdrop.
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    title,
    onclose,
    wide = false,
    children,
  }: { title: string; onclose: () => void; wide?: boolean; children: Snippet } = $props();

  let dialog: HTMLDialogElement;

  $effect(() => {
    dialog.showModal();
    return () => dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="modal"
  class:modal--wide={wide}
  aria-label={title}
  oncancel={(e) => {
    e.preventDefault();
    onclose();
  }}
  onclick={(e) => {
    if (e.target === dialog) onclose();
  }}
>
  <div class="modal__box">
    <header class="modal__head">
      <span class="mono">{title}</span>
      <button type="button" class="icon-btn" aria-label="Close" onclick={onclose}><Icon name="x" /></button>
    </header>
    <div class="modal__body">
      {@render children()}
    </div>
  </div>
</dialog>

<style>
  .modal {
    margin: auto;
    padding: 0;
    border: 0;
    background: none;
    color: var(--fg);
    width: min(26rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
  }
  .modal--wide {
    width: min(34rem, calc(100vw - 2rem));
  }
  .modal::backdrop {
    background: rgba(5, 5, 6, 0.6);
    backdrop-filter: blur(3px);
  }
  .modal__box {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 2rem);
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    background: var(--bg-soft);
    overflow: hidden;
  }
  .modal__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    border-bottom: 1px solid var(--line);
  }
  .modal__body {
    padding: 1rem;
    overflow-y: auto;
    min-height: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .modal[open] .modal__box {
      animation: modal-in 0.22s var(--ease) both;
    }
  }
  @keyframes modal-in {
    from {
      opacity: 0;
      translate: 0 10px;
    }
  }
</style>
