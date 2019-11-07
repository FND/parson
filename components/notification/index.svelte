<script>
export let type = null;
export let message = null;
export let confirmation = null;

function confirm(action) {
	action();
	dismiss();
}

function dismiss() { // NB: doubles as event handler
	type = message = confirmation = null;
}
</script>

{#if message || confirmation}
<div class="notification" class:is-warning={type === "warning"}
		class:is-error={type === "error"} aria-live="polite">
	{#if message}
	<p>{message}</p>
	<button type="button" on:click={dismiss}>×</button>
	{:else}
	<div class="prompt">
		<p>{confirmation.message}</p>
		<button type="button" on:click={ev => confirm(confirmation.prompt.action)}>
			{confirmation.prompt.caption}
		</button>
	</div>
	<button type="button" on:click={dismiss}>×</button>
	{/if}
</div>
{/if}
