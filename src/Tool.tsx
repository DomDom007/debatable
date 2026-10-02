// Debatable: run debates between schools: Swiss pairing, motions, rubric scoring by judges, and live standings.
import { useState } from "react";
import { uid, useStored } from "./lib/store";
import { Section, ShareBox, Stat, Stats } from "./ui/kit";
import { useShared } from "./lib/useShared";

const T = "debatable";
type Team = { id: string; name: string; school: string };
type Score = { content: number; style: number; strategy: number };
type Debate = { id: string; prop: string; opp: string; judge: string; motion: string; p?: Score; o?: Score };
type Round = { n: number; motion: string; debates: Debate[] };
type Standing = { t: Team; wins: number; pts: number; props: number; played: string[] };
const RUBRIC: { k: keyof Score; label: string; hint: string }[] = [
  { k: "content", label: "Content", hint: "Arguments, evidence, rebuttal" }, { k: "style", label: "Style", hint: "Clarity, confidence, pace" }, { k: "strategy", label: "Strategy", hint: "Structure, time use, answering the motion" },
];
const MOTIONS = ["This house would ban homework in primary school", "This house believes social media does more harm than good to teenagers", "This house would make voting compulsory", "This house would replace exams with continuous assessment", "This house believes tourism does more good than harm to local communities", "This house would teach coding instead of a second foreign language"];
const total = (s?: Score) => (s ? s.content + s.style + s.strategy : 0);

function standings(teams: Team[], rounds: Round[]): Standing[] {
  const st: Record<string, Standing> = Object.fromEntries(teams.map(t => [t.id, { t, wins: 0, pts: 0, props: 0, played: [] }]));
  rounds.forEach(r => r.debates.forEach(d => {
    if (!st[d.prop] || !st[d.opp]) return;
    st[d.prop].played.push(d.opp); st[d.opp].played.push(d.prop); st[d.prop].props++;
    if (d.p && d.o) { st[d.prop].pts += total(d.p); st[d.opp].pts += total(d.o); if (total(d.p) > total(d.o)) st[d.prop].wins++; else if (total(d.o) > total(d.p)) st[d.opp].wins++; }
  }));
  return Object.values(st).sort((a, b) => b.wins - a.wins || b.pts - a.pts);
}

export default function Debatable() {
  const shared = useShared<{ name: string; table: { name: string; school: string; wins: number; pts: number }[] }>();
  const [name, setName] = useStored(T, "name", "Tunis Schools Debate League");
  const [teams, setTeams] = useStored<Team[]>(T, "teams", [
    { id: "t1", name: "Carthage A", school: "Lycée Carthage" }, { id: "t2", name: "Carthage B", school: "Lycée Carthage" }, { id: "t3", name: "Pilote Ariana", school: "Lycée Pilote Ariana" },
    { id: "t4", name: "Menzah Voices", school: "Collège El Menzah" }, { id: "t5", name: "Sfax Speakers", school: "Lycée Sfax" }, { id: "t6", name: "Bizerte Bay", school: "Lycée Bizerte" },
  ]);
  const [judges, setJudges] = useStored(T, "judges", "Mme Karoui, M. Jaziri, Mme Sassi");
  const [rounds, setRounds] = useStored<Round[]>(T, "rounds", []);
  const [nt, setNt] = useState({ name: "", school: "" });
  const [motion, setMotion] = useState(MOTIONS[0]);
  const [err, setErr] = useState("");

  if (shared.data) return (
    <Section title={shared.data.name}>
      <table className="t"><thead><tr><th>#</th><th>Team</th><th className="r">Wins</th><th className="r">Points</th></tr></thead><tbody>{shared.data.table.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.name} <span className="note">{r.school}</span></td><td className="r">{r.wins}</td><td className="r">{r.pts}</td></tr>)}</tbody></table>
    </Section>
  );

  const table = standings(teams, rounds);
  const judgeList = judges.split(",").map(s => s.trim()).filter(Boolean);
  // Swiss pairing: sort by standing, pair neighbours who have not met yet; the team with fewer proposition turns proposes.
  const pairNext = () => {
    if (teams.length < 2) return setErr("Add at least two teams.");
    if (rounds.length && rounds[rounds.length - 1].debates.some(d => !d.p || !d.o)) return setErr("Score every debate in the current round first.");
    const pool = standings(teams, rounds).map(s => s);
    if (pool.length % 2) pool.push({ t: { id: "bye", name: "Bye", school: "" }, wins: 0, pts: 0, props: 0, played: [] });
    const debates: Debate[] = [];
    while (pool.length) {
      // Prefer a new opponent from another school, then any new opponent, then anyone.
      const a = pool.shift()!;
      let j = pool.findIndex(b => !a.played.includes(b.t.id) && b.t.school !== a.t.school);
      if (j < 0) j = pool.findIndex(b => !a.played.includes(b.t.id));
      if (j < 0) j = 0;
      const b = pool.splice(j, 1)[0];
      if (a.t.id === "bye" || b.t.id === "bye") continue;
      const [prop, opp] = a.props <= b.props ? [a, b] : [b, a];
      debates.push({ id: uid(), prop: prop.t.id, opp: opp.t.id, judge: judgeList[debates.length % Math.max(1, judgeList.length)] ?? "", motion });
    }
    setRounds([...rounds, { n: rounds.length + 1, motion, debates }]); setErr("");
    setMotion(MOTIONS[(MOTIONS.indexOf(motion) + 1) % MOTIONS.length]);
  };
  const setScore = (r: number, id: string, side: "p" | "o", k: keyof Score, v: number) => setRounds(rounds.map(x => x.n !== r ? x : { ...x, debates: x.debates.map(d => d.id !== id ? d : { ...d, [side]: { ...(d[side] ?? { content: 0, style: 0, strategy: 0 }), [k]: v } }) }));
  const tname = (id: string) => teams.find(t => t.id === id)?.name ?? "?";

  return (
    <div className="stack">
      <Section title={name}>
        <Stats><Stat value={teams.length} label="Teams" /><Stat value={rounds.length} label="Rounds" /><Stat value={rounds.reduce((a, r) => a + r.debates.length, 0)} label="Debates" /><Stat value={table[0]?.wins ? table[0].t.name : "–"} label="Leading" tone="good" /></Stats>
      </Section>
      <div className="grid2">
        <Section title="Standings">
          <table className="t"><thead><tr><th>#</th><th>Team</th><th className="r">Wins</th><th className="r">Points</th></tr></thead><tbody>{table.map((s, i) => <tr key={s.t.id}><td>{i + 1}</td><td>{s.t.name} <span className="note">{s.t.school}</span></td><td className="r"><strong>{s.wins}</strong></td><td className="r">{s.pts}</td></tr>)}</tbody></table>
          <div style={{ marginTop: 12 }}><ShareBox slug={T} data={{ name, table: table.map(s => ({ name: s.t.name, school: s.t.school, wins: s.wins, pts: s.pts })) }} label="Copy standings link" message={`${name} standings:`} /></div>
        </Section>
        <Section title="Next round">
          <label className="field"><span>Motion</span><select id="db-m" className="input" value={motion} onChange={e => setMotion(e.target.value)}>{MOTIONS.map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="field" style={{ marginTop: 8 }}><span>Or write your own</span><input className="input" value={motion} onChange={e => setMotion(e.target.value)} /></label>
          <label className="field" style={{ marginTop: 8 }}><span>Judges, separated by commas</span><input id="db-j" className="input" value={judges} onChange={e => setJudges(e.target.value)} /></label>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={pairNext}>Pair round {rounds.length + 1}</button>
          {err && <p className="pill bad" style={{ marginTop: 8 }}>{err}</p>}
        </Section>
      </div>
      {[...rounds].reverse().map(r => (
        <Section key={r.n} title={`Round ${r.n}`} aside={<span className="note">“{r.motion}”</span>}>
          <div className="stack" style={{ gap: 14 }}>{r.debates.map(d => { const tp = total(d.p), to = total(d.o), done = d.p && d.o; return (
            <div key={d.id} className="db-debate">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><strong>{tname(d.prop)} <span className="note">(proposition)</span> vs {tname(d.opp)} <span className="note">(opposition)</span></strong><span className="note">Judge: {d.judge || "not set"}</span></div>
              <div className="db-grid">
                <span />{RUBRIC.map(x => <b key={x.k} title={x.hint}>{x.label}</b>)}<b>Total</b>
                {(["p", "o"] as const).map(side => [<em key={side}>{tname(side === "p" ? d.prop : d.opp)}</em>, ...RUBRIC.map(x => <select key={side + x.k} className="input" aria-label={`${x.label} ${side}`} value={d[side]?.[x.k] ?? 0} onChange={e => setScore(r.n, d.id, side, x.k, +e.target.value)}><option value={0}>–</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>), <strong key={side + "t"} className="num" style={{ color: done && ((side === "p" && tp > to) || (side === "o" && to > tp)) ? "var(--good)" : undefined }}>{total(d[side])}</strong>])}
              </div>
              {done && <p>{tp === to ? <span className="pill warn">Tied. The judge must separate them by a point.</span> : <span className="pill good">{tname(tp > to ? d.prop : d.opp)} win</span>}</p>}
            </div>); })}</div>
          <button className="btn ghost small danger" style={{ marginTop: 10 }} onClick={() => setRounds(rounds.filter(x => x.n !== r.n))}>Delete round</button>
        </Section>
      ))}
      <Section title="Teams">
        {teams.map(t => <div key={t.id} className="row" style={{ padding: "4px 0", alignItems: "center" }}><input className="input" style={{ flex: 1 }} aria-label="Team" value={t.name} onChange={e => setTeams(teams.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))} /><input className="input" style={{ flex: 1 }} aria-label="School" value={t.school} onChange={e => setTeams(teams.map(x => x.id === t.id ? { ...x, school: e.target.value } : x))} /><button className="btn ghost small danger" onClick={() => setTeams(teams.filter(x => x.id !== t.id))}>×</button></div>)}
        <form className="row" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); if (!nt.name.trim()) return; setTeams([...teams, { id: uid(), ...nt, name: nt.name.trim() }]); setNt({ name: "", school: nt.school }); }}><input className="input" style={{ flex: 1 }} aria-label="New team" placeholder="Team name" value={nt.name} onChange={e => setNt({ ...nt, name: e.target.value })} /><input className="input" style={{ flex: 1 }} aria-label="School" placeholder="School" value={nt.school} onChange={e => setNt({ ...nt, school: e.target.value })} /><button className="btn small" type="submit">Add team</button></form>
        <label className="field" style={{ marginTop: 12, maxWidth: 400 }}><span>League name</span><input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
      </Section>
      <style>{`.db-debate{padding:12px;border:1px solid var(--line);border-radius:10px;display:grid;gap:10px}.db-grid{display:grid;grid-template-columns:minmax(100px,1.4fr) repeat(3,minmax(60px,1fr)) 60px;gap:6px;align-items:center}.db-grid b{font-size:12px;font-family:var(--mono);font-weight:500;color:var(--muted);text-transform:uppercase}.db-grid em{font-style:normal;font-weight:600}.db-grid .input{padding:6px}`}</style>
    </div>
  );
}
