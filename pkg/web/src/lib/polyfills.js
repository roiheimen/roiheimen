window.addEventListener("load", fixDialog, { once: true });

window.HTMLDialogElement = HTMLDivElement;

const sleep = sec => new Promise(res => setTimeout(res, sec * 1000));

async function fixDialog() {
  const dialogs = document.querySelectorAll("dialog");
  if (!dialogs.length) return;
  if (dialogs[0].showModal) return;
  console.log("Loading dialog polyfill");
  const { default: { registerDialog } } = await import('https://cdn.skypack.dev/dialog-polyfill@^0.5.1');
  await sleep(4);
  console.log("a", registerDialog);
  dialogs.forEach(registerDialog)
  window.dispatchEvent(new Event("apprefresh"));
}
