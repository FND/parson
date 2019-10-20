<script>
export let caption, value;
</script>

<style>
b {
	font-weight: normal;
	display: block;
}
</style>

<label>
	<b>{caption}</b>
	<input bind:value={value} on:change>
</label>
