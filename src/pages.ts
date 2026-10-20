// The server's web pages, made for phones: joining, pairing a device,
// your own page, and the admin's.

export const MODES = ["Deadline", "Evolved", "Sequence", "Waves", "Pacifism", "King"];

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function date(t: number | null | undefined): string {
  return t ? new Date(t * 1000).toISOString().slice(0, 10) : "never";
}

const STYLE = `
:root { --bg: #03040b; --panel: #0a0d1c; --edge: #1b2b6e; --ink: #e4e9ff; --dim: #98a1cc;
  --glow: #ff28c8; --cyan: #6fe8ff; --warn: #ffd23f; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  background-image: linear-gradient(#10183a 1px, transparent 1px), linear-gradient(90deg, #10183a 1px, transparent 1px);
  background-size: 40px 40px; }
main { max-width: 640px; margin: 0 auto; padding: 24px max(16px, env(safe-area-inset-right)) 48px max(16px, env(safe-area-inset-left));
  display: grid; gap: 20px; }
h1 { margin: 0; font-size: 28px; color: #fff; text-shadow: 0 0 14px var(--glow); }
h2 { margin: 0; font-size: 18px; color: var(--cyan); text-transform: uppercase; letter-spacing: .08em; }
p { margin: 0; }
a { color: var(--cyan); }
.group { color: var(--dim); font-size: 14px; text-transform: uppercase; letter-spacing: .12em; }
.panel { background: rgba(10, 13, 28, .92); border: 1px solid var(--edge); border-radius: 8px; padding: 16px; display: grid; gap: 12px; }
form { display: grid; gap: 10px; margin: 0; }
form.inline { display: inline; }
label { display: grid; gap: 4px; color: var(--dim); font-size: 14px; }
input { font: inherit; color: var(--ink); background: #000; border: 1px solid var(--edge); border-radius: 6px; padding: 10px 12px; width: 100%; }
button { font: inherit; color: #fff; background: rgba(255, 40, 200, .16); border: 1px solid var(--glow); border-radius: 6px;
  padding: 10px 16px; cursor: pointer; }
button.quiet { background: none; border-color: var(--edge); color: var(--dim); padding: 4px 10px; font-size: 14px; }
.error { color: var(--warn); }
.big { font: 700 32px/1.2 ui-monospace, Consolas, monospace; letter-spacing: .12em; color: #fff; }
.code { font-family: ui-monospace, Consolas, monospace; word-break: break-all; color: var(--cyan); }
table { width: 100%; border-collapse: collapse; font-size: 15px; }
td, th { text-align: left; padding: 6px 4px; border-bottom: 1px solid var(--edge); vertical-align: top; }
th { color: var(--dim); font-weight: 400; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.wrap { overflow-x: auto; }
ol { margin: 0; padding-left: 22px; display: grid; gap: 6px; }
`;

export function page(group: string, title: string, body: string): string {
  // "<group> · geow2 scores", or just the one name while the group has the
  // default (GROUP_NAME unset or "geow2 scores").
  const label = group.toLowerCase() === "geow2 scores" ? group : `${group} · geow2 scores`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${esc(title === group ? title : `${title} · ${group}`)}</title><style>${STYLE}</style></head>
<body><main><p class="group">${esc(label)}</p>${body}</main></body></html>`;
}

export function message(group: string, title: string, text: string, extra = ""): string {
  return page(group, title, `<h1>${esc(title)}</h1><p>${text}</p>${extra}`);
}

// --- Players -------------------------------------------------------------------

export function invitePage(group: string, code: string, error = "", name = ""): string {
  return page(
    group,
    "Join",
    `<h1>Join ${esc(group)}</h1>
<p>You've been invited to share geow2 high scores with this group. Choose the name the others will see on the boards.</p>
<form method="post" class="panel">
  <label for="name">Your name (up to 20 characters)
    <input id="name" name="name" value="${esc(name)}" maxlength="20" autocomplete="nickname" required autofocus></label>
  ${error ? `<p class="error">${esc(error)}</p>` : ""}
  <button type="submit">Join</button>
</form>`,
  );
}

export function signInPage(group: string, name: string): string {
  return page(
    group,
    "Sign in",
    `<h1>Sign in as ${esc(name)}</h1>
<p>This link signs this phone in as <b>${esc(name)}</b>, so you can pair devices and change your name.</p>
<form method="post" class="panel"><button type="submit">Sign in</button></form>`,
  );
}

export const PAIR_STEPS = `<ol>
<li>In geow2, open <b>Help and options</b>, then <b>Online scores</b>.</li>
<li>Choose <b>Pair this device</b>. The game shows a code and a QR code.</li>
<li>Scan the QR code with this phone, or open this page's <b>Pair a device</b> and type the code.</li>
</ol>`;

export function mePage(
  group: string,
  name: string,
  csrf: string,
  devices: { id: string; name: string; created: number; last_seen: number | null }[],
  notice = "",
  error = "",
): string {
  const rows = devices
    .map(
      (d) => `<tr><td>${esc(d.name)}</td><td>${date(d.created)}</td><td>${date(d.last_seen)}</td>
<td><form method="post" action="/me/devices/${esc(d.id)}/revoke" class="inline"><input type="hidden" name="csrf" value="${esc(csrf)}">
<button class="quiet" type="submit">Unpair</button></form></td></tr>`,
    )
    .join("");
  return page(
    group,
    name,
    `<h1>${esc(name)}</h1>
${notice ? `<p>${notice}</p>` : ""}
<section class="panel"><h2>Pair a device</h2>${PAIR_STEPS}
<form method="get" action="/pair"><label for="code">Code shown in the game
<input id="code" name="code" autocomplete="off" autocapitalize="characters" placeholder="ABCD-EFGH"></label>
<button type="submit">Continue</button></form></section>
<section class="panel"><h2>Your devices</h2>
${devices.length ? `<div class="wrap"><table><tr><th>Device</th><th>Paired</th><th>Last sync</th><th></th></tr>${rows}</table></div>` : "<p>None yet.</p>"}
</section>
<section class="panel"><h2>Your name</h2>
<form method="post" action="/me/name"><input type="hidden" name="csrf" value="${esc(csrf)}">
<label for="rename">Name on the boards<input id="rename" name="name" value="${esc(name)}" maxlength="20" required></label>
${error ? `<p class="error">${esc(error)}</p>` : ""}
<button type="submit">Save</button></form></section>
<p><a href="/boards">The group's boards</a></p>
<form method="post" action="/me/signout"><input type="hidden" name="csrf" value="${esc(csrf)}">
<button class="quiet" type="submit">Sign this phone out</button></form>`,
  );
}

export function pairPage(group: string, name: string, deviceName: string, code: string, csrf: string): string {
  return page(
    group,
    "Pair",
    `<h1>Pair ${esc(deviceName)}?</h1>
<p>This links <b>${esc(deviceName)}</b> to <b>${esc(name)}</b>: its scores, unlocks and achievements join yours, and it shows the group's boards.</p>
<p class="big">${esc(code.slice(0, 4))}-${esc(code.slice(4))}</p>
<p>Check that the game shows the same code.</p>
<form method="post" action="/pair/${esc(code)}" class="panel"><input type="hidden" name="csrf" value="${esc(csrf)}">
<button type="submit">Pair</button></form>`,
  );
}

export function boardsPage(group: string, boards: { name: string; score: number }[][]): string {
  const tables = boards
    .map((rows, mode) =>
      rows.length
        ? `<section class="panel"><h2>${MODES[mode]}</h2><table>${rows
            .slice(0, 20)
            .map((r, i) => `<tr><td class="num">${i + 1}</td><td>${esc(r.name)}</td><td class="num">${r.score.toLocaleString("en-US")}</td></tr>`)
            .join("")}</table></section>`
        : "",
    )
    .join("");
  return page(group, "Boards", `<h1>Boards</h1>${tables || "<p>No games yet.</p>"}`);
}

// --- Admin ---------------------------------------------------------------------

export function adminLogin(group: string, error = ""): string {
  return page(
    group,
    "Admin",
    `<h1>Admin</h1>
<form method="post" action="/admin/login" class="panel">
<label for="secret">Admin secret (set when the server was deployed)<input id="secret" name="secret" type="password" required autofocus></label>
${error ? `<p class="error">${esc(error)}</p>` : ""}
<button type="submit">Sign in</button></form>`,
  );
}

export function adminPage(
  group: string,
  origin: string,
  csrf: string,
  data: {
    players: { id: string; name: string; created: number; devices: number; games: number }[];
    invites: { code: string; player: string | null; name: string | null; expires: number; max_uses: number; uses: number }[];
    devices: { id: string; name: string; created: number; last_seen: number | null; player: string }[];
    scores: { id: string; mode: number; score: number; time: number; player: string }[];
  },
  notice = "",
): string {
  const hidden = `<input type="hidden" name="csrf" value="${esc(csrf)}">`;
  const button = (action: string, label: string) =>
    `<form method="post" action="${action}" class="inline">${hidden}<button class="quiet" type="submit">${label}</button></form>`;
  const invites = data.invites
    .map(
      (i) => `<tr><td class="code">${esc(origin)}/${i.player ? "signin" : "invite"}/${esc(i.code)}</td>
<td>${i.player ? `sign in as ${esc(i.name)}` : `${i.max_uses - i.uses} join(s) left`}, until ${date(i.expires)}</td>
<td>${button(`/admin/invites/${esc(i.code)}/delete`, "Delete")}</td></tr>`,
    )
    .join("");
  const players = data.players
    .map(
      (p) => `<tr><td>${esc(p.name)}</td><td class="num">${p.games}</td><td class="num">${p.devices}</td>
<td><form method="post" action="/admin/players/${esc(p.id)}/rename" class="inline">${hidden}
<input name="name" value="${esc(p.name)}" maxlength="20" style="width:9em;padding:4px 6px"> <button class="quiet" type="submit">Rename</button></form>
${button(`/admin/players/${esc(p.id)}/signin`, "Sign-in link")} ${button(`/admin/players/${esc(p.id)}/remove`, "Remove")}</td></tr>`,
    )
    .join("");
  const devices = data.devices
    .map(
      (d) => `<tr><td>${esc(d.player)}</td><td>${esc(d.name)}</td><td>${date(d.last_seen)}</td>
<td>${button(`/admin/devices/${esc(d.id)}/revoke`, "Unpair")}</td></tr>`,
    )
    .join("");
  const scores = data.scores
    .map(
      (s) => `<tr><td>${esc(s.player)}</td><td>${MODES[s.mode] ?? s.mode}</td><td class="num">${s.score.toLocaleString("en-US")}</td>
<td>${date(s.time)}</td><td>${button(`/admin/scores/${esc(s.id)}/remove`, "Delete")}</td></tr>`,
    )
    .join("");
  return page(
    group,
    "Admin",
    `<h1>Admin</h1>${notice ? `<p>${notice}</p>` : ""}
<section class="panel"><h2>Invite people</h2>
<p>An invite link lets each person who opens it join with a name of their choice. Send it to your friends.</p>
<form method="post" action="/admin/invites">${hidden}
<label for="uses">How many people can join with it<input id="uses" name="uses" type="number" min="1" max="100" value="5"></label>
<label for="days">Valid for (days)<input id="days" name="days" type="number" min="1" max="365" value="14"></label>
<button type="submit">Make an invite link</button></form>
${invites ? `<div class="wrap"><table>${invites}</table></div>` : ""}</section>
<section class="panel"><h2>Players</h2>
${players ? `<div class="wrap"><table><tr><th>Name</th><th>Games</th><th>Devices</th><th></th></tr>${players}</table></div>` : "<p>Nobody yet.</p>"}
<p>A sign-in link signs a player's new phone in as them (for example when they lost the old one).</p></section>
<section class="panel"><h2>Devices</h2>
${devices ? `<div class="wrap"><table><tr><th>Player</th><th>Device</th><th>Last sync</th><th></th></tr>${devices}</table></div>` : "<p>None yet.</p>"}</section>
<section class="panel"><h2>Latest games</h2>
${scores ? `<div class="wrap"><table>${scores}</table></div>` : "<p>None yet.</p>"}</section>
<p><a href="/boards">The boards</a></p>
<form method="post" action="/admin/signout">${hidden}<button class="quiet" type="submit">Sign out</button></form>`,
  );
}
