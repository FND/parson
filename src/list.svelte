<script>
export let title, items, home;
</script>

<style>
header {
	display: flex;
}

h2 {
	flex-grow: 1;
	font-size: 2em;
}

ul {
	padding: 0;
	list-style-type: none;
}

li label {
	line-height: 2;
}

input:checked ~ * {
	text-decoration: line-through;
	color: #AAA;
}

svg {
	height: 2em; /* corresponds to `h2` -- XXX: hacky? */
	stroke: currentColor;
	stroke-width: 3;
	stroke-linecap: square;
	stroke-linejoin: bevel;
	fill: none;
}
</style>

<header>
	<h2>{title}</h2>
	<ul>
		<li>
			<a href={`#${home}`}>
				<!-- icon adapted from https://iconsvg.xyz -->
				<svg width="48" height="48" viewBox="0 0 24 24">
					<path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9" />
					<path d="M9 22V12h6v10M2 10.6L12 2l10 8.6" />
				</svg>
			</a>
		</li>
	</ul>
</header>

<ul>
	{#each items as { caption, done }}
	<li>
		<label>
			<input type="checkbox" bind:checked={done} on:change>
			<span>{caption}</span>
		</label>
	</li>
	{/each}
</ul>
