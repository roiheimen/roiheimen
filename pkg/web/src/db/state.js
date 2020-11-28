import "/web_modules/@ungap/custom-elements-builtin.js";
import { defineHook } from "/web_modules/heresy.js";
import { composeBundles, createSelector } from "/web_modules/redux-bundler.js";

import storage, { save } from "../lib/storage.js";
import { gql, live } from "../lib/graphql.js";

const creds = storage("creds");
const meeting_ = storage("meeting");

const meeting = {
  name: "meeting",
  init(store) {
    setTimeout(() => store.doMeetingInfoFetch(), 0);
  },
  reducer: (state = { started: false, failed: false, data: null }, { type, payload, error }) => {
    if (type == "MEETING_FETCH_STARTED") return { ...state, started: true };
    if (type == "MEETING_FETCH_FINISHED") return { ...state, data: payload.meetings };
    if (type == "MEETING_FETCH_FAILED") return { ...state, failed: error || true };
    return state;
  },

  doMeetingInfoFetch: () => async ({ dispatch }) => {
    dispatch({ type: "MEETING_FETCH_STARTED" });
    const query = `
      query StartInfo {
        meetings {
          nodes {
            id
            createdAt
            title
          }
        }
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
      const {
        currentPerson,
        meetings: { nodes: meetings },
      } = await gql(query);
      dispatch({ type: "MEETING_FETCH_FINISHED", payload: { currentPerson, meetings } });
    } catch (error) {
      dispatch({ type: "MEETING_FETCH_FAILED", error });
    }
  },

  selectMeetings: (state) => state.meeting.data,
  selectMeetingId: createSelector("selectQueryObject", (queryObject) => queryObject.m || meeting_.id),
  selectMeeting: createSelector("selectMeetingId", "selectMeetings", (meetingId, meetings) =>
    meetings?.find((m) => m.id === meetingId)
  ),
};

const myself = {
  name: "myself",
  reducer: (state = { started: false, data: null, errors: null }, { type, payload, error }) => {
    if (type == "MEETING_FETCH_FINISHED") return { ...state, data: payload.currentPerson, errors: null };
    if (type == "MYSELF_LOGIN_FAILED") return { ...state, errors: payload };
    return state;
  },

  doMyselfLogout: () => ({ dispatch }) => {
    if (Object.keys(creds).length) {
      dispatch({ type: "MYSELF_LOGOUT" });
      Object.keys(creds).forEach((k) => delete creds[k]);
      save("creds");
      location.assign("/");
    }
  },
  doMyselfLogin: (num, password) => async ({ dispatch, store }) => {
    dispatch({ type: "MYSELF_LOGIN_STARTED" });
    const gqlLogin = `
      mutation Login($num: Int!, $mId: String!, $password: String!) {
        authenticate(input: {num: $num, meetingId: $mId, password: $password}) {
          jwtToken
        }
      }`;
    try {
      const res = await gql(gqlLogin, { num, mId: store.selectMeetingId(), password }, { nocreds: true });
      const { authenticate: { jwtToken } } = res;
      if (!jwtToken) {
        throw new Error("Feil nummer/passord");
      }
      creds.jwt = jwtToken;
      save("creds");
      dispatch({ type: "MYSELF_LOGIN_FINISHED" });
      location.assign("/queue.html");
    } catch (error) {
      const payload = error.extra?.body?.errors?.map((e) => e.message) || ["" + error];
      dispatch({ type: "MYSELF_LOGIN_FAILED", payload, error });
    }
  },

  selectMyself: (state) => state.myself.data,
  selectMyselfId: (state) => state.myself.data?.id,
  selectMyselfMeetingId: (state) => state.myself.data?.meetingId,
  selectMyselfErrors: (state) => state.myself.errors,
};

const people = {
  name: "people",
  reducer: (state = { started: false, failed: false, data: null }, { type, payload, error }) => {
    if (type == "PEOPLE_FETCH_STARTED") return { ...state, started: true };
    if (type == "PEOPLE_FETCH_FAILED") return { ...state, failed: error || true };
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

  selectPeopleRaw: (state) => state.people,
  selectPeople: (state) => state.people.data || [],
  selectPeopleById: createSelector("selectPeople", (people) => people.reduce((o, v) => ({ ...o, [v.id]: v }), {})),

  reactFetchPeopleOnMyselfExisting: createSelector("selectPeopleRaw", "selectMyself", (raw, myself) => {
    if (!raw.started && !raw.data && !raw.failed && myself?.id) {
      return { actionCreator: "doPeopleFetch" };
    }
  }),
};

const sak = {
  name: "sak",
  reducer: (state = { started: false, failed: false, data: {} }, { type, payload, error }) => {
    if (type == "SAK_SUB_STARTED") return { ...state, started: true };
    if (type == "SAK_SUB_FAILED") return { ...state, failed: error || true };
    if (type == "SAK_SUB_UPDATED") return { ...state, data: payload };
    return state;
  },

  doSakFinish: (sakId) => async ({ dispatch, store }) => {
    sakId = sakId ?? store.selectSakId();
    dispatch({ type: "SAK_FINISH_STARTED", payload: sakId });
    const query = `
    mutation SakEnd($sakId: Int!) {
      updateSak(input: {id: $sakId, patch: { finishedAt: "now()" }}) {
        clientMutationId
      }
    }
    `;
    try {
      const res = await gql(query, { sakId });
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
      const {
        createSak: { sak },
      } = res;
      dispatch({ type: "SAK_REQ_FINISHED", payload: sak });
    } catch (error) {
      dispatch({ type: "SAK_REQ_FAILED", error });
    }
  },
  doSakSubscribe: () => async ({ dispatch }) => {
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
        const {
          saks: { nodes },
        } = data;
        dispatch({ type: "SAK_SUB_UPDATED", payload: nodes[0] });
      });
      dispatch({ type: "SAK_SUB_FINISHED" });
    } catch (error) {
      dispatch({ type: "SAK_SUB_FAILED", error });
    }
  },

  selectSakRaw: (state) => state.sak,
  selectSak: (state) => state.sak.data,
  selectSakId: (state) => state.sak.data?.id,
  selectSakObj: createSelector("selectPeopleById", "selectSak", "selectSpeeches", (peopleById, sak, speeches) => {
    const nsak = {
      ...sak,
      speeches: (speeches || []).map((speech) => ({
        ...speech,
        speaker: peopleById[speech.speakerId] || {},
      })),
    };
    return nsak;
  }),

  reactSakSubscribeOnMyselfExisting: createSelector("selectSakRaw", "selectMyselfId", (raw, myselfId) => {
    if (!raw.started && !raw.failed && myselfId) {
      return { actionCreator: "doSakSubscribe" };
    }
  }),
};

const speech = {
  name: "speech",
  reducer: (
    state = { subSak: 0, subStop: null, subscribing: false, data: [], fetching: false, scheduled: false },
    { type, payload }
  ) => {
    if (type == "SPEECH_REQ_STARTED") return { ...state, fetching: true };
    if (type == "SPEECH_REQ_FINISHED") return { ...state, fetching: false, current: payload };
    if (type == "SPEECH_SUB_STARTED") return { ...state, subSak: payload, subscribing: true, subStop: null };
    if (type == "SPEECH_SUB_FINISHED") return { ...state, subStop: payload, subscribing: false };
    if (type == "SPEECH_SUB_FAILED") return { ...state, subscribing: false };
    if (type == "SPEECH_SUB_UPDATED") return { ...state, data: payload };
    //if (type == "SAK_SUB_UPDATED") return { ...state, started: false, data: [] };
    return state;
  },
  getMiddleware: () => (store) => (next) => (action) => {
    const oldSakId = store.selectSak()?.id;
    const result = next(action);
    const newSakId = store.selectSak()?.id;
    if (oldSakId != newSakId) {
    }
    return result;
  },

  doSpeechReq: (type = "INNLEGG", { speakerId, sakId, parentId } = {}) => async ({ dispatch, store }) => {
    speakerId = speakerId ?? store.selectMyself().id;
    sakId = sakId ?? store.selectSak().id;
    const { current } = store.selectSpeechState();
    parentId = parentId ?? (type == "REPLIKK" ? current?.parentId || current?.id : undefined);
    dispatch({
      type: "SPEECH_REQ_STARTED",
      payload: { type, speakerId, sakId, parentId },
    });
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
        createSpeech: { speech },
      } = res;
      dispatch({ type: "SPEECH_REQ_FINISHED", payload: speech });
    } catch (error) {
      dispatch({ type: "SPEECH_REQ_FAILED", error });
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
    mutation SpeechNext(${[current && `$currentId: Int!`, prev && `$prevId: Int!`].filter(Boolean).join(",")}) {
      ${
        currentId
          ? `current: updateSpeech(input: {id: $currentId, patch: { startedAt: null }}) { clientMutationId }`
          : ""
      }
      ${prevId ? `prev: updateSpeech(input: {id: $prevId, patch: { endedAt: null }}) { clientMutationId }` : ""}
    }`;
    try {
      const res = await gql(query, { currentId, prevId });
      dispatch({
        type: "SPEECH_NEXT_FINISHED",
        payload: { currentId, prevId },
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
    mutation SpeechNext(${[currentId && `$currentId: Int!`, nextId && `$nextId: Int!`].filter(Boolean).join(",")}) {
      ${
        currentId
          ? `current: updateSpeech(input: {id: $currentId, patch: { endedAt: "now()" }}) { clientMutationId }`
          : ""
      }
      ${nextId ? `next: updateSpeech(input: {id: $nextId, patch: { startedAt: "now()" }}) { clientMutationId }` : ""}
    }`;
    try {
      const res = await gql(query, { currentId, nextId });
      dispatch({
        type: "SPEECH_NEXT_FINISHED",
        payload: { currentId, nextId },
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
    const { subStop } = store.selectSpeechRaw();
    dispatch({ type: "SPEECH_SUB_STARTED", payload: sakId });
    if (subStop) subStop();
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
        const {
          speeches: { nodes },
        } = data;
        dispatch({ type: "SPEECH_SUB_UPDATED", payload: nodes });
      });
      dispatch({ type: "SPEECH_SUB_FINISHED", payload: stop });
    } catch (error) {
      dispatch({ type: "SPEECH_SUB_FAILED", error });
    }
  },

  selectSpeechRaw: (state) => state.speech,
  selectSpeech: (state) => state.speech.current,
  selectSpeechFetching: (state) => state.speech.fetching,
  selectSpeechScheduled: (state) => !!state.speech.current,
  selectSpeeches: createSelector("selectSpeechRaw", (raw) => {
    return raw.data
      .map((speech) => ({
        ...speech,
        status: speech.startedAt ? (speech.endedAt ? "ended" : "started") : speech.endedAt ? "cancelled" : "waiting",
      }))
      .sort((a, b) => (a.parentId || a.id) - (b.parentId || b.id));
  }),
  selectSpeechesValid: createSelector("selectSpeeches", (speeches) =>
    speeches
      .map((speech, i) => {
        // ignore speeches that ended without ever starting
        if (!speech.startedAt && speech.endedAt) return;
        return { ...speech, out: i % 2 == 0 ? "a" : "b" };
      })
      .filter(Boolean)
  ),
  selectSpeechState: createSelector("selectSpeechesValid", (speeches) => {
    const state = {
      prev: null,
      current: null,
      next: null,
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
  selectSpeechesUpcomingByMe: createSelector("selectMyself", "selectSpeechesValid", (myself, speeches) => {
    return speeches.filter((speech) => !speech.endedAt && speech.speakerId == myself.id);
  }),
  selectSpeechInWhereby: createSelector(
    "selectMyself",
    "selectSpeechesUpcomingByMe",
    "selectSpeechState",
    (myself, speechesUpcomingByMe, speechState) => {
      return speechState.next?.speakerId == myself?.id || speechState.current?.speakerId == myself?.id;
    }
  ),

  reactSpeechesUpdateOnSakChange: createSelector("selectSpeechRaw", "selectSakId", (raw, sakId) => {
    if (sakId && sakId != raw.subSak && !raw.subscribing) {
      return { actionCreator: "doSpeechSubscribe", args: [sakId] };
    }
  }),
};

const referendum = {
  name: "referendum",
  reducer: (
    state = {
      count: [],
      data: [],
      fetching: false,
      prevChoice: null,
      subSak: 0,
      subStop: null,
      subscribing: false,
    },
    { type, payload }
  ) => {
    if (type == "REFERENDUM_REQ_STARTED") return { ...state, fetching: true };
    if (type == "REFERENDUM_REQ_FINISHED") return { ...state, fetching: false, current: payload };
    if (type == "REFERENDUM_SUB_STARTED") return { ...state, subSak: payload, subscribing: true, subStop: null };
    if (type == "REFERENDUM_SUB_FINISHED") return { ...state, subStop: payload, subscribing: false };
    if (type == "REFERENDUM_SUB_FAILED") return { ...state, subscribing: false };
    if (type == "REFERENDUM_SUB_UPDATED") return { ...state, data: payload };
    if (type == "REFERENDUM_VOTE_STARTED")
      return {
        ...state,
        prevChoice: state.data.find((r) => r.id == payload.referendumId)?.type == "OPEN" ? payload.choice : null,
      };
    if (type == "REFERENDUM_COUNT_FINISHED") return { ...state, count: payload };
    return state;
  },
  getMiddleware: () => (store) => (next) => (action) => {
    const oldSakId = store.selectSak()?.id;
    const result = next(action);
    const newSakId = store.selectSak()?.id;
    if (oldSakId != newSakId) {
    }
    return result;
  },

  doReferendumReq: ({ type, title, choices, sakId }) => async ({ dispatch, store }) => {
    sakId = sakId ?? store.selectSak().id;
    dispatch({
      type: "REFERENDUM_REQ_STARTED",
      payload: { type, title, choices, sakId },
    });
    const query = `
      mutation CreateReferendum($title: String!, $sakId: Int!, $choices: JSON!, $type: ReferendumType!) {
        createReferendum(input: {referendum: {title: $title, sakId: $sakId, choices: $choices, type: $type}}) {
          clientMutationId
        }
      }`;
    try {
      const res = await gql(query, {
        sakId,
        type,
        title,
        choices,
      });
      dispatch({ type: "REFERENDUM_REQ_FINISHED", payload: res });
    } catch (error) {
      dispatch({ type: "REFERENDUM_REQ_FAILED", error });
    }
  },
  doReferendumEnd: (referendumId) => async ({ dispatch, store }) => {
    dispatch({ type: "REFERENDUM_END_STARTED", payload: referendumId });
    const query = `
    mutation ReferendumEnd($id: Int!) {
      updateReferendum(input: {id: $id, patch: { finishedAt: "now()" }}) {
        clientMutationId
      }
    }
    `;
    try {
      const res = await gql(query, { id: referendumId });
      dispatch({ type: "REFERENDUM_END_FINISHED", payload: referendumId });
    } catch (error) {
      dispatch({ type: "REFERENDUM_END_FAILED", error, payload: referendumId });
    }
  },
  doReferendumSubscribe: (sakId) => async ({ dispatch }) => {
    sakId = sakId ?? store.selectSak().id;
    const { subStop } = store.selectReferendumRaw();
    dispatch({ type: "REFERENDUM_SUB_STARTED", payload: sakId });
    if (subStop) subStop();
    const query = `
      subscription Referendums($sakId: Int!) {
        referendums(condition: {sakId: $sakId}) {
          nodes {
            choices
            id
            title
            type
            createdAt
            finishedAt
            votes {
              nodes {
                id
                personId
              }
            }
          }
        }
      }
      `;
    const variables = { sakId };
    try {
      const stop = await live({ query, variables }, ({ data }) => {
        const {
          referendums: { nodes },
        } = data;
        dispatch({ type: "REFERENDUM_SUB_UPDATED", payload: nodes });
      });
      dispatch({ type: "REFERENDUM_SUB_FINISHED", payload: stop });
    } catch (error) {
      dispatch({ type: "REFERENDUM_SUB_FAILED", error });
    }
  },
  doReferendumVote: ({ referendumId, choice }) => async ({ dispatch, store }) => {
    const personId = store.selectMyself().id;
    dispatch({
      type: "REFERENDUM_VOTE_STARTED",
      payload: { personId, choice, referendumId },
    });
    const query = `
    mutation ReferendumVote($referendumId: Int!, $personId: Int!, $choice: String!) {
      createVote(input: {vote: {vote: $choice, referendumId: $referendumId, personId: $personId}}) {
        vote { id }
      }
    }
    `;
    try {
      const res = await gql(query, { referendumId, choice, personId });
      const id = res.createVote.vote.id;
      dispatch({ type: "REFERENDUM_VOTE_FINISHED", payload: id });
    } catch (error) {
      dispatch({
        type: "REFERENDUM_VOTE_FAILED",
        error,
        payload: referendumId,
      });
    }
  },
  doReferendumCount: ({ sakId } = {}) => async ({ dispatch, store }) => {
    sakId = sakId ?? store.selectSakId();
    dispatch({ type: "REFERENDUM_COUNT_STARTED", payload: { sakId } });
    const query = `
      query VoteCount($sakId: Int!) {
        voteCount(sakId: $sakId) {
          nodes {
            referendumId
            choice
            cnt
          }
        }
      }
    `;
    try {
      const res = await gql(query, { sakId });
      dispatch({
        type: "REFERENDUM_COUNT_FINISHED",
        payload: res.voteCount.nodes,
      });
    } catch (error) {
      dispatch({ type: "REFERENDUM_COUNT_FAILED", error, payload: sakId });
    }
  },

  selectReferendumRaw: (state) => state.referendum,
  selectReferendumsData: (state) => state.referendum.data,
  selectReferendumCountData: (state) => state.referendum.count,
  selectReferendumPrevChoice: (state) => state.referendum.prevChoice,
  selectReferendum: createSelector("selectReferendums", (referendums) => referendums.filter((r) => !r.finishedAt)[0]),
  selectReferendumVote: createSelector("selectMyselfId", "selectReferendum", (myselfId, referendum) =>
    referendum?.votes.nodes.find((v) => v.personId == myselfId)
  ),
  selectReferendums: createSelector(
    "selectReferendumsData",
    "selectReferendumCountData",
    (referendumsData, referendumCountData) => {
      const refCnt = {};
      for (const c of referendumCountData) {
        const id = c.referendumId;
        if (!refCnt[id]) refCnt[id] = [];
        refCnt[id].push(c);
      }
      return referendumsData.map((r) => {
        if (refCnt[r.id]) {
          const counts = [...r.choices, ""].map((choice) => ({
            choice,
            count: +refCnt[r.id]?.find((rf) => rf.choice == choice)?.cnt || 0,
          }));
          return { ...r, counts };
        }
        return r;
      });
    }
  ),

  reactReferendumUpdateOnSakChange: createSelector("selectReferendumRaw", "selectSakId", (raw, sakId) => {
    if (sakId && sakId != raw.subSak && !raw.subscribing) {
      return { actionCreator: "doReferendumSubscribe", args: [sakId] };
    }
  }),
};

const out = {
  name: "out",
  reducer: (state = { currentType: "" }, { type, payload }) => {
    if (type == "OUT_SWITCH") return { ...state, currentType: payload };
    return state;
  },
  getMiddleware: () => (store) => (next) => (action) => {
    const { current: oldCurrent } = store.selectSpeechState();
    const result = next(action);
    const { current } = store.selectSpeechState();
    if (oldCurrent && current?.id !== oldCurrent?.id) {
      store.doOutSwitch(store.selectOutTypeForCurrent());
    }
    return result;
  },

  doOutSwitch: (currSpeechId) => ({ type: "OUT_SWITCH" }),

  selectOutRaw: (state) => state.out,
  selectOutTypeForCurrent: createSelector("selectSpeeches", (speeches) => {
    return speeches.length % 2 == 0 ? "a" : "b";
  }),
};

const test = {
  name: "test",
  reducer: (
    state = { requested: false, subPerson: 0, subscribing: false, subStop: null, data: [] },
    { type, payload }
  ) => {
    if (type == "TEST_REQ_STARTED") return { ...state, requested: true };
    if (type == "TEST_REQ_FAILED") return { ...state, requested: false };
    if (type == "TEST_SUB_STARTED") return { ...state, subPerson: payload, subscribing: true, subStop: null };
    if (type == "TEST_SUB_FINISHED") return { ...state, subStop: payload, subscribing: false };
    if (type == "TEST_SUB_FAILED") return { ...state, subscribing: false };
    if (type == "TEST_SUB_UPDATED") return { ...state, data: payload };
    if (type == "CLIENT_UI") {
      if (!["", "settings"].includes(payload)) throw new Error(`Unexpecetd ui ${payload}`);
      return { ...state, ui: payload };
    }
    return state;
  },

  doTestReq: ({ requesterId } = {}) => async ({ dispatch }) => {
    requesterId = requesterId ?? store.selectMyselfId();
    dispatch({ type: "TEST_REQ_STARTED", payload: requesterId });
    const query = `
      mutation NewTest($requesterId: Int!) {
        createTest(input: {test: {requesterId: $requesterId}}) {
          test { id }
        }
      }`;
    try {
      const res = await gql(query, { requesterId });
      const {
        createTest: { test },
      } = res;
      dispatch({ type: "TEST_REQ_FINISHED", payload: test });
    } catch (error) {
      dispatch({ type: "TEST_REQ_FAILED", error, payload: requesterId });
    }
  },
  doTestUpdateStatus: (id, status) => async ({ dispatch }) => {
    dispatch({ type: "TEST_UPD_STARTED", payload: { id, status } });
    const query = `
      mutation {
        updateTest(input: {id: ${id}, patch: {${
      { start: `startedAt: "now()"`, stop: `finishedAt: "now()"` }[status]
    }}}) {
          test { id }
        }
      }`;
    try {
      const res = await gql(query);
      const {
        updateTest: { test },
      } = res;
      dispatch({ type: "TEST_REQ_FINISHED", payload: test });
    } catch (error) {
      dispatch({ type: "TEST_REQ_FAILED", error, payload: id });
    }
  },
  doTestSubscribe: (requesterId) => async ({ dispatch }) => {
    requesterId = requesterId ?? store.selectMyselfId();
    const { subStop } = store.selectTestRaw();
    // Limit to self in common case, but allow "all"
    dispatch({ type: "TEST_SUB_STARTED", payload: requesterId });
    if (subStop) subStop();
    const query = `
      subscription Tests${requesterId == "all" ? "" : "($requesterId: Int!)"} {
        tests${requesterId == "all" ? "" : "(condition: {requesterId: $requesterId})"} {
          nodes {
            id
            requesterId
            createdAt
            startedAt
            finishedAt
          }
        }
      }`;
    const variables = { requesterId };
    try {
      const stop = await live({ query, variables }, ({ data }) => {
        const {
          tests: { nodes },
        } = data;
        dispatch({ type: "TEST_SUB_UPDATED", payload: nodes });
      });
      dispatch({ type: "TEST_SUB_FINISHED", payload: stop });
    } catch (error) {
      dispatch({ type: "TEST_SUB_FAILED", error });
    }
  },

  selectTestRaw: (state) => state.test,
  selectTests: (state) => state.test.data,
  selectTestListenAll: (state) => state.test.subPerson == "all",
  selectTest: createSelector("selectTests", "selectMyselfId", (tests, myselfId) =>
    tests.filter((t) => t.requesterId == myselfId).find((t) => !t.finishedAt)
  ),
  selectTestHasHad: createSelector("selectTests", "selectMyselfId", (tests, myselfId) =>
    tests.some((t) => t.requesterId == myselfId)
  ),
  selectTestActive: createSelector("selectTests", (tests) => tests.filter((t) => t.startedAt && !t.finishedAt)[0]),
  selectTestStatus: createSelector("selectTestRaw", "selectTest", (raw, test) => {
    if (test?.startedAt) return "active";
    if (test) return "waiting";
    if (raw.requesting) return "requesting";
    if (raw.subStop) return "listening";
    if (raw.subPerson) return "starting";
    return "";
  }),

  reactTestSubscribeOnMyselfExisting: createSelector("selectTestRaw", "selectMyselfId", (raw, myselfId) => {
    // subPerson can be "all", or your own ID
    if (myselfId && !raw.subscribing && !raw.subPerson && raw.subPerson != myselfId) {
      return { actionCreator: "doTestSubscribe" };
    }
  }),
};

const client = {
  name: "client",
  reducer: (state = { ui: "" }, { type, payload }) => {
    if (type == "CLIENT_UI") {
      if (!["", "settings"].includes(payload)) throw new Error(`Unexpecetd ui ${payload}`);
      return { ...state, ui: payload };
    }
    return state;
  },

  doClientUi: (ui) => ({ type: "CLIENT_UI", payload: ui }),

  selectClientUi: (state) => state.client.ui,
};

const errors = {
  name: "errors",
  getMiddleware: () => (store) => (next) => (action) => {
    const result = next(action);
    if (
      action.type.endsWith("_FAILED") &&
      action.error?.extra?.body?.errors?.[0]?.message == "jwt expired" &&
      !["/", "/login.html"].includes(location.pathname)
    ) {
      store.doMyselfLogout();
    }
    return result;
  },
};

const store = composeBundles(meeting, myself, speech, sak, people, referendum, out, test, client, errors)();
window.store = store;

function addSelect(sel) {
  return sel.map((s) => "select" + s[0].toUpperCase() + s.slice(1));
}

defineHook("useSel", ({ useMemo, useRef, useState, useEffect }) => (...args) => {
  const selectors = useMemo(() => addSelect(args), args);
  const [state, setState] = useState(() => store.select(selectors));
  const prevSelectors = useRef(selectors);

  useEffect(() => {
    if (prevSelectors.current !== selectors) {
      prevSelectors.current = selectors;
      setState(store.select(selectors));
    }
    return store.subscribeToSelectors(selectors, (changes) => {
      setState((currentState) => ({ ...currentState, ...changes }));
    });
  }, [selectors, prevSelectors]);

  if (prevSelectors.current === selectors) {
    return state;
  }
  return { ...store.select(selectors) };
});

defineHook("useStore", () => () => store);

defineHook("usePrevious", ({ useRef, useEffect }) => (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
});
