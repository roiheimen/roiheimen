function fail(msg) {
  console.warn(msg);
  process.exit(1);
}

// sorting of speeches
const tests = [
  { createdAt: 4, startedAt: 5, finishedAt: 6 },
  { createdAt: 5, startedAt: 6, finishedAt: null },
  { createdAt: 6, startedAt: 5, finishedAt: 6 },
  { createdAt: 7, startedAt: null, finishedAt: null },
  { createdAt: 8, startedAt: 5, finishedAt: 6 },
];
tests.sort((a, b) => {
  if (a.startedAt !== b.startedAt) return a.startedAt - b.startedAt;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.finishedAt - b.finishedAt;
});
if (JSON.stringify(tests) !== JSON.stringify( [
  { createdAt: 7, startedAt: null, finishedAt: null },
  { createdAt: 4, startedAt: 5, finishedAt: 6 },
  { createdAt: 6, startedAt: 5, finishedAt: 6 },
  { createdAt: 8, startedAt: 5, finishedAt: 6 },
  { createdAt: 5, startedAt: 6, finishedAt: null },
]))
  fail(`Sort didn't work`);
