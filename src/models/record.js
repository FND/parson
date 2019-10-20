export default class Record {
	constructor(data) {
		let ctor = this.constructor;
		if(!ctor._normalized) { // generate accessors
			ctor._normalized = Object.entries(ctor.slots).
				reduce((memo, [slot, handler]) => {
					makeAccessors(ctor.prototype, slot, handler);
					return handler ? memo.concat(slot) : memo;
				}, []);
		}

		this._data = data;
	}

	toJSON() {
		let { _normalized } = this.constructor;
		let { _data } = this;
		if(!_normalized.length) {
			return _data;
		}
		// ensure normalized values' `#toJSON` is used if present
		return _normalized.reduce((memo, slot) => {
			let value = this[slot];
			memo[slot] = value && jsonify(value);
			return memo;
		}, Object.assign({}, _data));
	}
}

function makeAccessors(proto, slot, handler) {
	Object.defineProperty(proto, slot, {
		get() {
			let value = this._data[slot];
			return handler ? handler(value) : value;
		},
		set(value) {
			this._data[slot] = value; // XXX: asymmetrical; skips `handler` normalization
		}
	});
}

function jsonify(value) {
	if(value.pop) {
		return value.map(jsonify);
	}
	return value.toJSON ? value.toJSON() : value;
}
