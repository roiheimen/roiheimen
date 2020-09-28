import { defineHook } from "/web_modules/heresy.js";
import { composeBundles } from "/web_modules/redux-bundler.js";

import { gql } from "../lib/graphql.js";

const myself = {
  name: "myself",
  init(store) {
    setTimeout(() => store.doMyselfFetch(), 0);
  },
  reducer: (state = true, { type, payload }) => {
    if (type == "MYSELF_FETCH_FINISHED") {
      return payload;
    }
    if (type == "MYSELF_FETCH_FAILED") {
      return false;
    }
    return state;
  },

  doMyselfFetch: () => async ({ dispatch }) => {
    dispatch({ type: "MYSELF_FETCH_STARTED" });
    const gqlMyself = `
      query Myself {
        currentPerson {
          name
          id
          num
          meetingId
          admin
        }
      }`;
    try {
      const { currentPerson } = await gql(gqlMyself);
      dispatch({ type: "MYSELF_FETCH_FINISHED", payload: currentPerson });
    } catch (error) {
      dispatch({ type: "MYSELF_FETCH_FAILED", error });
    }
  },

  selectMyself: state => state.myself,
};

const innlegg = {
  name: "innlegg",
  reducer: (
    state = { fetching: false, scheduled: false },
    { type, payload }
  ) => {
    if (type == "INNLEGG_REQ_STARTED") {
      return { ...state, fetching: true };
    }
    if (type == "INNLEGG_REQ_FINISHED") {
      return { ...state, fetching: false, current: payload };
    }
    return state;
  },

  doReqInnlegg: () => ({ dispatch }) => {
    setTimeout(() => dispatch({ type: "INNLEGG_REQ_FINISHED" }), 2048);
  },
  doReqInnlegg: (type="INNLEGG", speakerId) => async ({ dispatch, store }) => {
    dispatch({ type: "INNLEGG_REQ_STARTED" });
    speakerId = speakerId ?? store.selectMyself().id;
    const gqlCreateSpeech = `
      mutation CreateSpeech($speakerId: Int!, $type: SpeechType!) {
        createSpeech(input: {speech: {speakerId: $speakerId, type: $type}}) {
          speech {
            id
            speakerId
          }
        }
      }`;
    try {
      const res = await gql(gqlCreateSpeech, {
        speakerId,
        type
      });
      const {
        createSpeech: { speech }
      } = res;
      dispatch({ type: "INNLEGG_REQ_FINISHED", payload: speech });
    } catch (error) {
      dispatch({ type: "INNLEGG_REQ_FAILED", error });
    }
  },


  selectInnlegg: state => state.innlegg.current,
  selectInnleggFetching: state => state.innlegg.fetching,
  selectInnleggScheduled: state => !!state.innlegg.current,
};

const store = composeBundles(myself, innlegg)();
window.store = store;

function addSelect(sel) {
  return sel.map(s => "select" + s[0].toUpperCase() + s.slice(1));
}

defineHook("useSel", ({ useMemo, useState, useEffect }) => (...sel) => {
  const fullSel = addSelect(sel);
  const [state, setState] = useState(() => store.select(fullSel));
  useEffect(() => {
    return store.subscribeToSelectors(fullSel, changes =>
      setState(currentState => ({ ...state, ...changes }))
    );
  });
  return state;
});

defineHook("useStore", () => () => store);
