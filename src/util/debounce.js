// adapted from uitil
export default function debounce(delay, fn) {
	let timer;
	return (...args) => {
		if(timer) {
			clearTimeout(timer);
			timer = null;
		}
		timer = setTimeout(() => {
			fn(...args);
			timer = null;
		}, delay);
	};
}
