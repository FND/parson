<script>
export let type = null;
export let message = null;

let onDismiss = ev => {
	type = message = null;
};
</script>

{#if message}
	<div class="notification" class:is-error={type === "error"} aria-live="polite">
		<p>{message}</p>
		<button type="button" on:click={onDismiss}>×</button>
	</div>
{/if}
