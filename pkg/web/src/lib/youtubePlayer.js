const playerStates = new Map();
const CREATE_PLAYER_TIMEOUT = 20000;
const LOAD_API_TIMEOUT = 5000;

const noop = () => {};

export const CUED_STATE = "cued";
export const PAUSED_STATE = "paused";
export const UNSTARTED_STATE = "unstarted";
export const PLAYING_STATE = "playing";
export const ENDED_STATE = "ended";
export const BUFFERING_STATE = "buffering";

// https://developers.google.com/youtube/iframe_api_reference
export function loadYoutubeApi({ timeoutMs = LOAD_API_TIMEOUT, src = "https://www.youtube.com/iframe_api" } = {}) {
  if (typeof window.YT !== "undefined") {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout while loading the youtube api")), timeoutMs);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      resolve();
    };
    const scriptEl = document.createElement("script");
    scriptEl.src = src;
    scriptEl.onerror = (e) => {
      clearTimeout(timeout);
      reject(e);
    };
    const headEl = document.querySelector("head");
    headEl.appendChild(scriptEl);
  });
}

export function createPlayer({
  autoplay,
  controls,
  elementRef,
  videoref,
  mute,
  startTime,
  onPlaying,
  onPaused,
  onEnded,
  onBuffering,
  timeoutMs = CREATE_PLAYER_TIMEOUT,
}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out while creating the player")), timeoutMs);
    const playerstateHandlers = {
      [BUFFERING_STATE]: onBuffering,
      [PLAYING_STATE]: onPlaying,
      [PAUSED_STATE]: onPaused,
      [ENDED_STATE]: onEnded,
    };
    const { PlayerState } = window.YT;

    // eslint-disable-next-line no-new
    new window.YT.Player(elementRef, {
      height: "100%",
      width: "100%",
      videoId: videoref,
      playerVars: {
        autoplay: autoplay ? 1 : 0, // autoplay on load
        controls: controls ? 1 : 0, // scrubbing, volume etc
        disablekb: 1, // enable keyboard https://developers.google.com/youtube/player_parameters?playerVersion=HTML5#disablekb
        iv_load_policy: 1, // eslint-disable-line camelcase
        modestbranding: 1, // do not show youtube logo https://developers.google.com/youtube/player_parameters?playerVersion=HTML5#modestbranding
        mute: mute ? 1 : 0, // mute when playback starts
        ...(typeof startTime !== "undefined" && { start: parseInt(startTime, 10) }), // only accepts integers - https://developers.google.com/youtube/player_parameters.html?playerVersion=HTML5#start
      },
      events: {
        onReady: ({ target: player }) => {
          clearTimeout(timeout);
          // create mapping between integer values and string representations
          playerStates.set(PlayerState.UNSTARTED, UNSTARTED_STATE);
          playerStates.set(PlayerState.ENDED, ENDED_STATE);
          playerStates.set(PlayerState.PLAYING, PLAYING_STATE);
          playerStates.set(PlayerState.PAUSED, PAUSED_STATE);
          playerStates.set(PlayerState.BUFFERING, BUFFERING_STATE);
          playerStates.set(PlayerState.CUED, CUED_STATE);
          resolve(player);
        },
        onStateChange: ({ target: player }) => {
          const { playerInfo } = player;
          // convert integer value into string representation
          const playerstate = playerStates.get(playerInfo.playerState);
          (playerstateHandlers[playerstate] || noop)({ playerstate, playerInfo, player });
        },
        // detect changes in playback quality
        onPlaybackQualityChange: noop,
        onPlaybackRateChange: ({ data }) => {
          // Future iterations: change playback rate in non-presenter clients
          console.warn(`Playback rate is change to ${data}x. This might cause synchornization issues across players`);
        },
        onError: ({ data }) => {
          switch (data) {
            case 2:
              console.error(
                "The request contains an invalid parameter value. Did you specify a video ID that does not have 11 characters, or if the video ID contains invalid characters, such as exclamation points or asterisks?"
              );
              break;
            case 5:
              console.error(
                "The requested content cannot be played in an HTML5 player or another error related to the HTML5 player has occurred"
              );
              break;
            case 100:
              console.error(
                "The video requested was not found. Has the video been removed (for any reason) or been marked as private?"
              );
              break;
            case 101:
            case 150:
              console.error("The owner of the requested video does not allow it to be played in embedded players.");
              break;
            default:
              console.error(`An unknown error has occurred. Error code: ${data}`);
          }
        },
        // may be used to detect caption changes
        onApiChange: noop,
      },
    });
  });
}
