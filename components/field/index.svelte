<script>
export let caption, value;
</script>

<label>
	<b>{caption}</b>
	<input type="text" bind:value={value} on:change>
</label>
