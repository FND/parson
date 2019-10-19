import svelte from "rollup-plugin-svelte";
import resolve from "rollup-plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import path from "path";

let PRODUCTION = process.env.NODE_ENV === "production";
let CSS = path.resolve(__dirname, "./dist/bundle.css");

export default {
	input: "./src/index.js",
	output: {
		format: "iife",
		file: path.resolve(__dirname, "./dist/bundle.js"),
		sourcemap: true
	},
	plugins: [
		svelte({
			dev: !PRODUCTION,
			css: css => {
				css.write(CSS, true);
			}
		}),
		resolve({
			browser: true,
			dedupe: importee => importee === "svelte" || importee.startsWith("svelte/")
		}),
		PRODUCTION && terser({ compress: false, mangle: false })
	],
	watch: {
		clearScreen: false
	}
};
