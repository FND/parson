<script>
export let caption, value;
</script>

<label>
	<b>{caption}</b>
	<input bind:value={value} on:change>
</label>
