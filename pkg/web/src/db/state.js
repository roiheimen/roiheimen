import { defineHook } from "/web_modules/heresy.js";

const initialState = {
  counter: 0
};

const reducer = (state, { type, payload }) => {
  if (type == "up") {
    return { ...state, counter: state.counter + 1 };
  }
  if (type == "set") {
    return { ...state, counter: payload };
  }
  if (type == "INNLEGG_REQ_STARTED") {
    return { ...state, inleggFetching: true };
  }
  if (type == "INNLEGG_REQ_FINISHED") {
    return { ...state, innleggFetching: false, innleggScheduled: true };
  }
  if (type == "WHEREBY_LEFT") {
    return { ...state, innleggScheduled: true };
  }
  return state;
};

defineHook("useDb", ({ useReducer }) => () =>
  useReducer(reducer, initialState)
);

export function doReqInnlegg(dispatch) {
  dispatch({ type: "INNLEGG_REQ_STARTED" });
  setTimeout(() => dispatch({ type: "INLEGG_REQ_FINISHED" }), 2048);
}
