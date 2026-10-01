<script lang="ts">
  // Floating "Ask Sensei": a corner button opens a chat that knows what the
  // learner is looking at (a card or a kanji). Each context keeps its own
  // thread while the page is open, so stepping back to a card finds the
  // conversation where it was. On phones it is a bottom sheet that rides above
  // the on-screen keyboard; its close button is always inside the sheet.
  import Icon from './Icon.svelte';
  import { api } from '../../lib/supabase';
  import { renderMarkdown } from '../../lib/markdown';
  import type { AskContext, ChatTurn } from '../../lib/types';

  let {
    context,
    contextKey,
    suggestions = ['Can you explain this more?', 'Give me another example.', 'How is this used in real life?'],
    onsavetonote,
  }: {
    context: AskContext;
    contextKey: string;
    suggestions?: string[];
    onsavetonote?: (content: string) => Promise<boolean>;
  } = $props();

  let open = $state(false);
  let convos = $state<Record<string, ChatTurn[]>>({});
  const messages = $derived(convos[contextKey] ?? []);
  let input = $state('');
  let loading = $state(false);
  let saved = $state<Record<string, 'saving' | 'saved'>>({});
  let kb = $state(0);
  let scroller = $state<HTMLDivElement>();
  let textarea = $state<HTMLTextAreaElement>();

  // ---- the floating button can be dragged out of the way ------------------
  const POS_KEY = 'ask:pos';
  let offset = $state(readPos());
  let drag: { x: number; y: number; ox: number; oy: number; moved: boolean } | null = null;
  function readPos() {
    try {
      const v = JSON.parse(sessionStorage.getItem(POS_KEY) ?? 'null');
      if (v && typeof v.x === 'number' && typeof v.y === 'number') return v as { x: number; y: number };
    } catch {}
    return { x: 0, y: 0 };
  }
  function fabDown(e: PointerEvent) {
    drag = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function fabMove(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    // Keep it on screen: it starts at the bottom-right corner.
    offset = {
      x: Math.min(0, Math.max(-(innerWidth - 80), drag.ox + dx)),
      y: Math.min(0, Math.max(-(innerHeight - 140), drag.oy + dy)),
    };
  }
  function fabUp() {
    if (!drag) return;
    const wasDrag = drag.moved;
    drag = null;
    if (wasDrag) {
      try {
        sessionStorage.setItem(POS_KEY, JSON.stringify(offset));
      } catch {}
    } else {
      open = true;
    }
  }

  // ---- iOS: the keyboard doesn't push fixed elements up -------------------
  $effect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const overlap = innerHeight - vv.height - vv.offsetTop;
      kb = overlap > 1 ? Math.round(overlap) : 0;
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      kb = 0;
    };
  });

  // Follow the stream to the bottom.
  $effect(() => {
    void messages.length;
    void messages[messages.length - 1]?.content;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });

  // Grow the box with what's typed, up to a cap.
  $effect(() => {
    void input;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  });

  function setThread(key: string, turns: ChatTurn[]) {
    convos[key] = turns;
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const key = contextKey;
    const ctx = $state.snapshot(context) as AskContext;
    input = '';
    const withUser: ChatTurn[] = [...messages, { role: 'user', content }];
    setThread(key, [...withUser, { role: 'assistant', content: '' }]);
    loading = true;
    let acc = '';
    try {
      const res = await api('/api/ask', { method: 'POST', body: JSON.stringify({ context: ctx, messages: withUser }) });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setThread(key, [...withUser, { role: 'assistant', content: acc }]);
      }
      if (!acc.trim()) throw new Error('empty');
    } catch {
      setThread(key, [
        ...withUser,
        { role: 'assistant', content: acc || "_Sensei couldn't answer just now — try again._" },
      ]);
    } finally {
      loading = false;
    }
  }

  async function saveToNote(content: string, i: number) {
    if (!onsavetonote) return;
    const k = `${contextKey}:${i}`;
    saved[k] = 'saving';
    const ok = await onsavetonote(content);
    if (ok) saved[k] = 'saved';
    else delete saved[k];
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (open && e.key === 'Escape') {
      e.stopImmediatePropagation();
      open = false;
    }
  }}
/>

{#if open}
  <section class="ask" style="--kb: {kb}px" aria-label="Ask Sensei" data-overlay>
    <header class="ask__head">
      <Icon name="message" />
      <span class="mono">Ask Sensei</span>
      <span class="ask__model faint mono">Gemini Flash</span>
      <button type="button" class="icon-btn" aria-label="Close" onclick={() => (open = false)}><Icon name="x" /></button>
    </header>

    <div class="ask__log" bind:this={scroller}>
      {#if !messages.length}
        <p class="dim ask__hint">Ask anything about what's on screen — nuance, usage, why it's this word and not another.</p>
        <div class="ask__sugg">
          {#each suggestions as s (s)}
            <button type="button" class="ask__s" onclick={() => send(s)}>{s}</button>
          {/each}
        </div>
      {/if}
      {#each messages as m, i (i)}
        {#if m.role === 'user'}
          <p class="ask__me jp">{m.content}</p>
        {:else}
          <div class="ask__them">
            {#if m.content}
              <div class="prose jp">{@html renderMarkdown(m.content)}</div>
              {#if onsavetonote && !(loading && i === messages.length - 1)}
                {@const k = `${contextKey}:${i}`}
                <button type="button" class="quiet" disabled={!!saved[k]} onclick={() => saveToNote(m.content, i)}>
                  {#if saved[k] === 'saved'}<Icon name="check" /> Saved to note
                  {:else if saved[k] === 'saving'}<span class="spin"></span> Saving…
                  {:else}<Icon name="bookmark" /> Save to note{/if}
                </button>
              {/if}
            {:else}
              <span class="spin dim"></span>
            {/if}
          </div>
        {/if}
      {/each}
    </div>

    <form
      class="ask__form"
      onsubmit={(e) => {
        e.preventDefault();
        void send(input);
      }}
    >
      <textarea
        bind:this={textarea}
        bind:value={input}
        onkeydown={onKey}
        rows="1"
        placeholder="Ask a question…"
        enterkeyhint="send"
        aria-label="Your question"
      ></textarea>
      <button type="submit" class="ask__send" disabled={loading || !input.trim()} aria-label="Send">
        {#if loading}<span class="spin"></span>{:else}<Icon name="send" />{/if}
      </button>
    </form>
  </section>
{:else}
  <button
    type="button"
    class="ask-fab"
    style="translate: {offset.x}px {offset.y}px"
    aria-label="Ask Sensei (drag to move)"
    onpointerdown={fabDown}
    onpointermove={fabMove}
    onpointerup={fabUp}
    onpointercancel={() => (drag = null)}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        open = true;
      }
    }}
  >
    <Icon name="message" size="1.25rem" /><span class="ask-fab__label">Ask Sensei</span>
  </button>
{/if}

<style>
  .ask-fab {
    position: fixed;
    right: max(1rem, env(safe-area-inset-right));
    bottom: calc(1rem + env(safe-area-inset-bottom));
    z-index: 60;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.8rem;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    box-shadow: 0 8px 28px rgba(39, 66, 240, 0.35);
    touch-action: none;
    cursor: grab;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .ask-fab:active {
    cursor: grabbing;
  }
  .ask-fab__label {
    display: none;
  }
  @media (min-width: 640px) {
    .ask-fab {
      padding: 0.8rem 1.15rem;
    }
    .ask-fab__label {
      display: inline;
    }
  }

  .ask {
    position: fixed;
    z-index: 70;
    left: 0;
    right: 0;
    bottom: var(--kb, 0px);
    max-height: calc(100dvh - var(--topbar-h) - env(safe-area-inset-top) - var(--kb, 0px) - 0.75rem);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--line-strong);
    border-bottom: 0;
    border-radius: 16px 16px 0 0;
    background: var(--bg-soft);
    box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.35);
    padding-bottom: env(safe-area-inset-bottom);
  }
  @media (min-width: 640px) {
    .ask {
      left: auto;
      right: 1rem;
      bottom: 1rem;
      width: 27.5rem;
      max-height: min(70vh, 40rem);
      border-bottom: 1px solid var(--line-strong);
      border-radius: 16px;
      padding-bottom: 0;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .ask {
      animation: ask-in 0.26s var(--ease) both;
    }
  }
  @keyframes ask-in {
    from {
      opacity: 0;
      translate: 0 18px;
    }
  }
  .ask__head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.45rem 0.45rem 1rem;
    border-bottom: 1px solid var(--line);
    color: var(--accent-text);
  }
  .ask__head .mono {
    color: var(--fg);
  }
  .ask__model {
    margin-left: auto;
    font-size: 0.55rem;
  }
  .ask__log {
    flex: 1;
    min-height: 6rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .ask__hint {
    font-size: 0.85rem;
  }
  .ask__sugg {
    display: grid;
    gap: 0.4rem;
  }
  .ask__s {
    text-align: left;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    font-size: 0.85rem;
    color: var(--fg-dim);
    transition:
      color 0.2s var(--ease),
      border-color 0.2s var(--ease);
  }
  .ask__s:hover {
    color: var(--fg);
    border-color: var(--line-strong);
  }
  .ask__me {
    align-self: flex-end;
    max-width: 85%;
    padding: 0.55rem 0.8rem;
    border-radius: 14px 14px 4px 14px;
    background: var(--accent-soft);
    font-size: 0.92rem;
    white-space: pre-wrap;
  }
  .ask__them {
    max-width: 94%;
    display: grid;
    gap: 0.3rem;
    justify-items: start;
  }
  .ask__form {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    margin: 0.6rem;
    padding: 0.45rem 0.45rem 0.45rem 0.85rem;
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    background: var(--bg);
  }
  .ask__form textarea {
    flex: 1;
    resize: none;
    border: 0;
    background: none;
    outline: none;
    max-height: 11rem;
    padding: 0.35rem 0;
    line-height: 1.45;
    font-size: 0.95rem;
  }
  .ask__send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.1rem;
    height: 2.1rem;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
  }
  .ask__send:disabled {
    opacity: 0.4;
  }
</style>
