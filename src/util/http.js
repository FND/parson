/* eslint-env browser */

// adapted from uitil
export default function httpRequest(method, uri, headers, body, { cors, strict } = {}) {
	let options = {
		method,
		credentials: cors ? "include" : "same-origin"
	};
	if(headers) {
		options.headers = headers;
	}
	if(body) {
		options.body = body;
	}

	let res = fetch(uri, options);
	return !strict ? res : res.then(res => {
		if(!res.ok) {
			throw new Error(`unexpected ${res.status} response at ${uri}`);
		}
		return res;
	});
}
