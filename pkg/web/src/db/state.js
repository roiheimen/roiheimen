import { defineHook } from "/web_modules/heresy.js";

const initialState = {
  counter: 0
};

const reducer = (state, { type, payload }) => {
  console.log("happening", type, payload);
  if (type == "up") {
    return { ...state, counter: state.counter + 1 };
  }
  if (type == "set") {
    return { ...state, counter: payload };
  }
  if (type == "INNLEGG_REQ_STARTED") {
    return { ...state, innleggFetching: true };
  }
  if (type == "INNLEGG_REQ_FINISHED") {
    return { ...state, innleggFetching: false, innleggScheduled: true };
  }
  if (type == "WHEREBY_LEFT") {
    return { ...state, innleggScheduled: true };
  }
  return state;
};

const store = {
  doReqInnlegg: () => ({ dispatch }) => {
    dispatch({ type: "INNLEGG_REQ_STARTED" });
    setTimeout(() => dispatch({ type: "INNLEGG_REQ_FINISHED" }), 2048);
  },
};

let state = initialState;
const dispatch = action => { state = reducer(state, action); };
dispatch({ type: "START" });

defineHook("useStore", ({ useState }) => () => {
  const [_, refresh] = useState(0);
  const boundStore = Object.keys(store).reduce((o, v) => {
    o[v] = (...args) => {
      const res = store[v](args);
      if (typeof res === "function") return res({ state, dispatch, store: boundStore });
      return res;
    }
    return o;
  }, {});
  boundStore.state = state;
  return boundStore;
});
