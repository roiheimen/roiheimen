// has some outlier bugs but not using it like that
export function dedent(s, ...args) {
  const dedented = s.map(
    (ss, i) =>
      ss
        .split(/\n/)
        .map((l) => l.trimLeft())
        .join("\n") + (args[i] || "")
  );
  return dedented.join("");
}
/*
    console.log("output:", dedent`
      nicely indented text
      here without ${"no"} intendation
      ${"hei"}
      in the output `;
*/
