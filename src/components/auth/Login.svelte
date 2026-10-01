<script lang="ts">
  // The one account's sign-in. After it, back to wherever the guard sent us
  // from (same-site paths only).
  import { onMount } from 'svelte';
  import { sb } from '../../lib/supabase';
  import { arrive } from '../../lib/mv';

  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');

  function next(): string {
    const n = new URLSearchParams(location.search).get('next') ?? '/';
    return n.startsWith('/') && !n.startsWith('//') ? n : '/';
  }

  onMount(async () => {
    const { data } = await sb().auth.getSession();
    if (data.session) location.replace(next());
  });

  async function signIn(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    const { error: err } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      busy = false;
      error = err.message === 'Invalid login credentials' ? 'That email and password don’t match.' : err.message;
      return;
    }
    location.replace(next());
  }
</script>

<form class="login spread--paper" onsubmit={signIn}>
  <span class="crop crop--tl"></span><span class="crop crop--tr"></span>
  <span class="crop crop--bl"></span><span class="crop crop--br"></span>

  <p class="mono">Japanese study · N2–N1</p>
  <h1 class="login__title jp-serif" use:arrive>俺様先生</h1>

  <label class="field">
    <span>Email</span>
    <input type="email" bind:value={email} autocomplete="username" required />
  </label>
  <label class="field">
    <span>Password</span>
    <input type="password" bind:value={password} autocomplete="current-password" required />
  </label>

  {#if error}<p class="login__error">{error}</p>{/if}

  <button class="btn btn--lead" type="submit" disabled={busy}>
    {#if busy}<span class="spin"></span> Checking…{:else}Sign in →{/if}
  </button>
</form>

<style>
  .login {
    position: relative;
    width: min(24rem, 100%);
    display: grid;
    gap: 1.2rem;
    padding: clamp(2rem, 6vw, 2.8rem);
    border-radius: 4px;
    box-shadow: 0 30px 70px -35px rgba(0, 0, 0, 0.7);
  }
  .login__title {
    font-size: clamp(2.6rem, 10vw, 3.4rem);
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: 0.04em;
    margin-bottom: 0.4rem;
  }
  .login__error {
    font-size: 0.85rem;
    color: #c2410c;
  }
  .btn {
    justify-self: start;
  }
</style>
