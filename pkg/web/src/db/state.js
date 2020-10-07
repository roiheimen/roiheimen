import { defineHook } from "/web_modules/heresy.js";
import { composeBundles, createSelector } from "/web_modules/redux-bundler.js";

import storage from "../lib/storage.js";
import { gql, live } from "../lib/graphql.js";

const creds = storage("creds");

const myself = {
  name: "myself",
  init(store) {
    if (creds.jwt) setTimeout(() => store.doMyselfFetch(), 0);
  },
  reducer: (
    state = { started: false, failed: false, data: null },
    { type, payload, error }
  ) => {
    if (type == "MYSELF_FETCH_STARTED") return { ...state, started: true };
    if (type == "MYSELF_FETCH_FINISHED") return { ...state, data: payload };
    if (type == "MYSELF_FETCH_FAILED")
      return { ...state, failed: error || true };
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
          room
        }
      }`;
    try {
      const { currentPerson } = await gql(gqlMyself);
      dispatch({ type: "MYSELF_FETCH_FINISHED", payload: currentPerson });
    } catch (error) {
      dispatch({ type: "MYSELF_FETCH_FAILED", error });
    }
  },
  doMyselfLogout: () => () => {
    if (Object.keys(creds).length) {
      Object.keys(creds).forEach(k => delete creds[k]);
      location.assign("/");
    }
  },

  selectMyself: state => state.myself.data
};

const sak = {
  name: "sak",
  reducer: (
    state = { started: false, failed: false, data: null },
    { type, payload, error }
  ) => {
    if (type == "SAK_FETCH_STARTED") return { ...state, started: true };
    if (type == "SAK_FETCH_FINISHED") return { ...state, data: payload };
    if (type == "SAK_FETCH_FAILED") return { ...state, failed: error || true };
    return state;
  },

  doSakFetch: () => async ({ dispatch }) => {
    dispatch({ type: "SAK_FETCH_STARTED" });
    const query = `
      subscription SakAndSpeeches {
        latestSak {
          id
          title
          speeches {
            nodes {
              speaker {
                id
                name
                room
                num
              }
              id
              type
              createdAt
              startedAt
              endedAt
            }
          }
        }
      }`;
    try {
      await live(query, ({ data }) => {
        const { latestSak } = data;
        const sak = { ...latestSak, speeches: latestSak.speeches.nodes };
        dispatch({ type: "SAK_FETCH_FINISHED", payload: sak });
      });
    } catch (error) {
      dispatch({ type: "SAK_FETCH_FAILED", error });
    }
  },

  selectSakRaw: state => state.sak,
  selectSak: state => state.sak.data,

  reactFetchSakOnMyselfExisting: createSelector(
    "selectSakRaw",
    "selectMyself",
    (raw, myself) => {
      if (!raw.started && !raw.data && !raw.failed && myself?.id) {
        return { actionCreator: "doSakFetch" };
      }
    }
  )
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

  doReqInnlegg: (type = "INNLEGG", speakerId, sakId) => async ({
    dispatch,
    store
  }) => {
    dispatch({ type: "INNLEGG_REQ_STARTED" });
    speakerId = speakerId ?? store.selectMyself().id;
    sakId = sakId ?? store.selectSak().id;
    const gqlCreateSpeech = `
      mutation CreateSpeech($speakerId: Int!, $type: SpeechType!, $sakId: Int!) {
        createSpeech(input: {speech: {speakerId: $speakerId, type: $type, sakId: $sakId}}) {
          speech {
            id
            speakerId
            sakId
            type
          }
        }
      }`;
    try {
      const res = await gql(gqlCreateSpeech, {
        sakId,
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
  doSpeechEnd: (speechId) => async ({ dispatch, store }) => {
    dispatch({ type: "SPEECH_END_STARTED", payload: speechId });
    const query = `
    mutation SpeechNext($id: Int!) {
      updateSpeech(input: {id: $id, patch: { endedAt: "now()" }}) {
        clientMutationId
      }
    }
    `;
    try {
      const res = await gql(query, { id: speechId });
      dispatch({ type: "SPEECH_END_FINISHED", payload: speechId });
    } catch (error) {
      dispatch({ type: "SPEECH_END_FAILED", error, payload: speechId });
    }
  },
  doSpeechPrev: () => async ({ dispatch, store }) => {
    const { current, prev } = store.selectSpeechState();
    const currentId = current?.id;
    const prevId = prev?.id;
    if (!current && !prev) {
      console.warn("No speech to start or end");
      return;
    }
    dispatch({ type: "SPEECH_NEXT_STARTED", payload: { prevId, currentId } });
    const query = `
    mutation SpeechNext(${[
      current && `$currentId: Int!`,
      prev && `$prevId: Int!`
    ]
      .filter(Boolean)
      .join(",")}) {
      ${
        currentId
          ? `current: updateSpeech(input: {id: $currentId, patch: { startedAt: null }}) { clientMutationId }`
          : ""
      }
      ${
        prevId
          ? `prev: updateSpeech(input: {id: $prevId, patch: { endedAt: null }}) { clientMutationId }`
          : ""
      }
    }`;
    try {
      const res = await gql(query, { currentId, prevId });
      dispatch({
        type: "SPEECH_NEXT_FINISHED",
        payload: { currentId, prevId }
      });
    } catch (error) {
      dispatch({ type: "SPEECH_NEXT_FAILED", error });
    }
  },
  doSpeechNext: () => async ({ dispatch, store }) => {
    const { current, next } = store.selectSpeechState();
    const currentId = current?.id;
    const nextId = next?.id;
    if (!currentId && !nextId) {
      console.warn("No speech to start or end");
      return;
    }
    dispatch({ type: "SPEECH_NEXT_STARTED", payload: { nextId, currentId } });
    const query = `
    mutation SpeechNext(${[
      currentId && `$currentId: Int!`,
      nextId && `$nextId: Int!`
    ]
      .filter(Boolean)
      .join(",")}) {
      ${
        currentId
          ? `current: updateSpeech(input: {id: $currentId, patch: { endedAt: "now()" }}) { clientMutationId }`
          : ""
      }
      ${
        nextId
          ? `next: updateSpeech(input: {id: $nextId, patch: { startedAt: "now()" }}) { clientMutationId }`
          : ""
      }
    }`;
    try {
      const res = await gql(query, { currentId, nextId });
      dispatch({
        type: "SPEECH_NEXT_FINISHED",
        payload: { currentId, nextId }
      });
    } catch (error) {
      dispatch({ type: "SPEECH_NEXT_FAILED", error });
    }
  },
  doSpeechUpdate: (id, updates) => async ({ dispatch, store }) => {
    dispatch({ type: "SPEECH_UPDATE_STARTED", payload: id });
    try {
      const query = `
      mutation UpdateSpeech($updates: SpeechPatch!) {
        updateSpeech(input: {id: $id, patch: $updates})
      }`;
      const res = await gql(query, { id, updates });
      dispatch({ type: "SPEECH_UPDATE_FINISHED", payload: { id, updates } });
    } catch (error) {
      dispatch({ type: "SPEECH_UPDATE_FAILED", error });
    }
  },

  selectInnlegg: state => state.innlegg.current,
  selectInnleggFetching: state => state.innlegg.fetching,
  selectInnleggScheduled: state => !!state.innlegg.current,
  selectSpeeches: createSelector("selectSak", sak =>
    (sak?.speeches || []).map((speech, i) => {
      // ignore speeches that ended without ever starting
      if (!speech.startedAt && speech.endedAt) return;
      return { ...speech, out: i % 2 == 0 ? "a" : "b" };
    }).filter(Boolean)
  ),
  selectSpeechState: createSelector("selectSpeeches", speeches => {
    const state = {
      prev: null,
      current: null,
      next: null
    };
    for (let i = 0; i < speeches.length; i++) {
      const speech = speeches[i];
      if (speech.endedAt) {
        state.prev = speech;
      }
      if (!state.current && speech.startedAt && !speech.endedAt) {
        state.current = speech;
      }
      if (!state.next && !speech.startedAt) {
        state.next = speech;
        break;
      }
    }
    return state;
  }),
  selectSpeechesUpcomingByMe: createSelector(
    "selectMyself",
    "selectSpeeches",
    (myself, speeches) => {
      return speeches.filter(
        speech => !speech.endedAt && speech.speaker.id == myself.id
      );
    }
  ),
  selectSpeechInWhereby: createSelector(
    "selectMyself",
    "selectSpeechesUpcomingByMe",
    "selectSpeechState",
    (myself, speechesUpcomingByMe, speechState) => {
      return (
        speechesUpcomingByMe.length ||
        speechState.current?.speaker.id == myself?.id
      );
    }
  )
};

const out = {
  name: "out",
  reducer: (state = { currentType: "" }, { type, payload }) => {
    if (type == "OUT_SWITCH") return { ...state, currentType: payload };
    return state;
  },
  getMiddleware: () => store => next => action => {
    const { current: oldCurrent } = store.selectSpeechState();
    const result = next(action);
    const { current } = store.selectSpeechState();
    if (oldCurrent && current?.id !== oldCurrent?.id) {
      store.doOutSwitch(store.selectOutTypeForCurrent());
    }
    return result;
  },

  doOutSwitch: currSpeechId => ({ type: "OUT_SWITCH" }),

  selectOutRaw: state => state.out,
  selectOutTypeForCurrent: createSelector("selectSpeeches", speeches => {
    return speeches.length % 2 == 0 ? "a" : "b";
  }),
};

const errors = {
  name: "errors",
  getMiddleware: () => store => next => action => {
    const result = next(action);
    if (
      action.type.endsWith("_FAILED") &&
      action.error?.extra?.body?.errors?.[0]?.message == "jwt expired" &&
      location.pathname != "/"
    ) {
      location.assign("/");
    }
    return result;
  }
};

const store = composeBundles(myself, innlegg, sak, out, errors)();
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

defineHook("usePrevious", ({ useRef, useEffect }) => (value) => {
  const ref = useRef();
  useEffect(() => { ref.current = value }, [value]);
  return ref.current;
});
