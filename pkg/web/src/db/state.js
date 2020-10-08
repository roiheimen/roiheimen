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

  selectMyself: state => state.myself.data,
  selectMyselfMeetingId: state => state.myself.data?.meetingId
};

const people = {
  name: "people",
  reducer: (
    state = { started: false, failed: false, data: null },
    { type, payload, error }
  ) => {
    if (type == "PEOPLE_FETCH_STARTED") return { ...state, started: true };
    if (type == "PEOPLE_FETCH_FAILED")
      return { ...state, failed: error || true };
    if (type == "PEOPLE_FETCH_UPDATED") return { ...state, data: payload };
    return state;
  },

  doPeopleFetch: () => async ({ dispatch }) => {
    dispatch({ type: "PEOPLE_FETCH_STARTED" });
    const query = `
      subscription People($meetingId: String!) {
        people(condition: {meetingId: $meetingId}) {
          nodes {
            id
            admin
            name
            num
            org
            room
          }
        }
      }
      `;
    const variables = { meetingId: store.selectMyselfMeetingId() };
    try {
      await live({ query, variables }, ({ data }) => {
        const { people } = data;
        dispatch({ type: "PEOPLE_FETCH_UPDATED", payload: people.nodes });
      });
      dispatch({ type: "PEOPLE_FETCH_FINISHED" });
    } catch (error) {
      dispatch({ type: "PEOPLE_FETCH_FAILED", error });
    }
  },

  selectPeopleRaw: state => state.people,
  selectPeople: state => state.people.data || [],
  selectPeopleById: createSelector("selectPeople", people =>
    people.reduce((o, v) => ({ ...o, [v.id]: v }), {})
  ),

  reactFetchPeopleOnMyselfExisting: createSelector(
    "selectPeopleRaw",
    "selectMyself",
    (raw, myself) => {
      if (!raw.started && !raw.data && !raw.failed && myself?.id) {
        return { actionCreator: "doPeopleFetch" };
      }
    }
  )
};

const sak = {
  name: "sak",
  reducer: (
    state = { started: false, failed: false, data: {} },
    { type, payload, error }
  ) => {
    if (type == "SAK_SUB_STARTED") return { ...state, started: true };
    if (type == "SAK_SUB_FAILED") return { ...state, failed: error || true };
    if (type == "SAK_SUB_UPDATED") return { ...state, data: payload };
    return state;
  },

  doSakFinish: sakId => async ({ dispatch, store }) => {
    dispatch({ type: "SAK_FINISH_STARTED", payload: sakId });
    sakId = sakId ?? store.selectSak().id;
    const query = `
    mutation SakEnd($id: Int!) {
      updateSak(input: {id: $id, patch: { finishedAt: "now()" }}) {
        clientMutationId
      }
    }
    `;
    try {
      const res = await gql(query, { id: sakId });
      dispatch({ type: "SAK_FINISH_FINISHED", payload: sakId });
    } catch (error) {
      dispatch({ type: "SAK_FINISH_FAILED", error, payload: sakId });
    }
  },
  doSakReq: (title, { meetingId } = {}) => async ({ dispatch }) => {
    dispatch({ type: "SAK_REQ_STARTED" });
    meetingId = meetingId ?? store.selectMyself().meetingId;
    const gqlNewSak = `
      mutation NewSak($meetingId: String!, $title: String!) {
        createSak(input: {sak: {title: $title, meetingId: $meetingId}}) {
          sak {
            id
            title
          }
        }
      }`;
    try {
      const res = await gql(gqlNewSak, { title, meetingId });
      const { createSak: { sak } } = res;
      dispatch({ type: "SAK_REQ_FINISHED", payload: sak });
    } catch (error) {
      dispatch({ type: "SAK_REQ_FAILED", error });
    }
  },
  doSakFetch: () => async ({ dispatch }) => {
    dispatch({ type: "SAK_SUB_STARTED" });
    const query = `
      subscription Sak {
        saks(condition: {finishedAt: null}, orderBy: CREATED_AT_DESC, first: 1) {
          nodes {
            id
            title
            createdAt
          }
        }
      }`;
    try {
      await live({ query }, ({ data }) => {
        const { saks: { nodes } } = data;
        dispatch({ type: "SAK_SUB_UPDATED", payload: nodes[0] });
      });
      dispatch({ type: "SAK_SUB_FINISHED" });
    } catch (error) {
      dispatch({ type: "SAK_SUB_FAILED", error });
    }
  },

  selectSakRaw: state => state.sak,
  selectSak: state => state.sak.data,
  selectSakId: state => state.sak.data.id,
  selectSakObj: createSelector(
    "selectPeopleById",
    "selectSak",
    "selectSpeeches",
    (peopleById, sak, speeches) => {
      const nsak = {
        ...sak,
        speeches: (speeches || []).map(speech => ({
          ...speech,
          speaker: peopleById[speech.speakerId] || {},
        }))
      };
      return nsak;
    }
  ),

  reactFetchSakOnMyselfExisting: createSelector(
    "selectSakRaw",
    "selectMyself",
    (raw, myself) => {
      if (!raw.started && !raw.failed && myself?.id) {
        return { actionCreator: "doSakFetch" };
      }
    }
  )
};

const speech = {
  name: "speech",
  reducer: (
    state = { started: false, data: [], fetching: false, scheduled: false },
    { type, payload }
  ) => {
    if (type == "SPEECH_REQ_STARTED") return { ...state, fetching: true };
    if (type == "SPEECH_REQ_FINISHED") return { ...state, fetching: false, current: payload };
    if (type == "SPEECH_SUB_STARTED") return { ...state, started: true };
    if (type == "SPEECH_SUB_FINISHED") return { ...state, stopSub: payload };
    if (type == "SPEECH_SUB_UPDATED") return { ...state, data: payload };
    //if (type == "SAK_SUB_UPDATED") return { ...state, started: false, data: [] };
    return state;
  },
  getMiddleware: () => store => next => action => {
    const oldSakId = store.selectSak()?.id;
    const result = next(action);
    const newSakId = store.selectSak()?.id;
    if (oldSakId != newSakId) {

    }
    return result;
  },

  doSpeechReq: (type = "INNLEGG", { speakerId, sakId, parentId } = {}) => async ({
    dispatch,
    store
  }) => {
    dispatch({ type: "SPEECH_REQ_STARTED" });
    speakerId = speakerId ?? store.selectMyself().id;
    sakId = sakId ?? store.selectSak().id;
    parentId = parentId ?? (type == "REPLIKK" ? store.selectSpeechState().current?.id : undefined);
    const gqlCreateSpeech = `
      mutation CreateSpeech($speakerId: Int!, $type: SpeechType!, $sakId: Int!, $parentId: Int) {
        createSpeech(input: {speech: {speakerId: $speakerId, type: $type, sakId: $sakId, parentId: $parentId}}) {
          speech {
            id
            speakerId
            sakId
            parentId
            type
          }
        }
      }`;
    try {
      const res = await gql(gqlCreateSpeech, {
        sakId,
        speakerId,
        type,
        parentId,
      });
      const {
        createSpeech: { speech }
      } = res;
      dispatch({ type: "SPEECH_REQ_FINISHED", payload: speech });
    } catch (error) {
      dispatch({ type: "SPEECH_REQ_FAILED", error });
    }
  },
  doSpeechEnd: speechId => async ({ dispatch, store }) => {
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
  doSpeechSubscribe: (sakId) => async ({ dispatch }) => {
    sakId = sakId ?? store.selectSak().id;
    const { stopSub } = store.selectSpeechRaw();
    dispatch({ type: "SPEECH_SUB_STARTED", payload: sakId });
    if (stopSub) stopSub();
    const query = `
      subscription Speeches($sakId: Int!) {
        speeches(condition: {sakId: $sakId}) {
          nodes {
            id
            speakerId
            sakId
            parentId
            type
            createdAt
            endedAt
            startedAt
          }
        }
      }
      `;
    const variables = { sakId };
    try {
      const stop = await live({ query, variables }, ({ data }) => {
        const { speeches: { nodes } } = data;
        dispatch({ type: "SPEECH_SUB_UPDATED", payload: nodes });
      });
      dispatch({ type: "SPEECH_SUB_FINISHED", payload: stop });
    } catch (error) {
      dispatch({ type: "SPEECH_SUB_FAILED", error });
    }
  },

  selectSpeechRaw: state => state.speech,
  selectSpeech: state => state.speech.current,
  selectSpeechStarted: state => state.speech.started,
  selectSpeechFetching: state => state.speech.fetching,
  selectSpeechScheduled: state => !!state.speech.current,
  selectSpeeches: createSelector("selectSpeechRaw", raw => {
    return raw.data.map((speech) => ({ ...speech, 
          status: speech.startedAt
            ? speech.endedAt
              ? "ended"
              : "started"
            : speech.endedAt
            ? "cancelled"
            : "waiting"
    })).sort((a, b) => (a.parentId || a.id) - (b.parentId || b.id));
  }),
  selectSpeechesValid: createSelector("selectSpeeches", speeches =>
    speeches
      .map((speech, i) => {
        // ignore speeches that ended without ever starting
        if (!speech.startedAt && speech.endedAt) return;
        return { ...speech, out: i % 2 == 0 ? "a" : "b" };
      })
      .filter(Boolean)
  ),
  selectSpeechState: createSelector("selectSpeechesValid", speeches => {
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
    "selectSpeechesValid",
    (myself, speeches) => {
      return speeches.filter(
        speech => !speech.endedAt && speech.speakerId == myself.id
      );
    }
  ),
  selectSpeechInWhereby: createSelector(
    "selectMyself",
    "selectSpeechesUpcomingByMe",
    "selectSpeechState",
    (myself, speechesUpcomingByMe, speechState) => {
      return (
        speechState.next?.speakerId == myself?.id ||
        speechState.current?.speakerId == myself?.id
      );
    }
  ),

  reactSpeechesUpdateOnSakChange: createSelector(
    "selectSakId",
    "selectSpeechStarted",
    (sakId, speechStarted) => {
    console.log("react speech");
      if (sakId && !speechStarted) {
        return { actionCreator: "doSpeechSubscribe", args: [sakId] };
      }
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
  })
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

const store = composeBundles(myself, speech, sak, people, out, errors)();
window.store = store;

function addSelect(sel) {
  return sel.map(s => "select" + s[0].toUpperCase() + s.slice(1));
}

defineHook(
  "useSel",
  ({ useMemo, useRef, useState, useEffect }) => (...args) => {
    const selectors = useMemo(() => addSelect(args), args);
    const [state, setState] = useState(() => store.select(selectors));
    const prevSelectors = useRef(selectors);

    useEffect(() => {
      if (prevSelectors.current !== selectors) {
        prevSelectors.current = selectors;
        setState(store.select(selectors));
      }
      return store.subscribeToSelectors(selectors, changes => {
        setState(currentState => ({ ...currentState, ...changes }));
      });
    }, [selectors]);

    return prevSelectors.current === selectors
      ? state
      : { ...store.select(selectors) };
  }
);

defineHook("useStore", () => () => store);

defineHook("usePrevious", ({ useRef, useEffect }) => value => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
});
