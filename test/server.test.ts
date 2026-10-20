// The whole flow as a group would use it: the admin invites, a player
// joins on a phone, pairs two devices, and the devices sync.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BASE = "https://scores.example";

// A browser: keeps its cookie between requests.
class Browser {
  cookie = "";
  async fetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    const r = await SELF.fetch(BASE + path, { ...init, headers, redirect: "manual" });
    const set = r.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    return r;
  }
  post(path: string, fields: Record<string, string>) {
    return this.fetch(path, { method: "POST", body: new URLSearchParams(fields) });
  }
  async csrf(path: string) {
    const html = await (await this.fetch(path)).text();
    return /name="csrf" value="([^"]+)"/.exec(html)?.[1] ?? "";
  }
}

const api = (path: string, body: unknown, token?: string) =>
  SELF.fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const event = (id: string, mode: number, score: number) => ({
  id: id.padEnd(32, "0"),
  mode,
  score,
  multiplier: 3,
  time: 1760000000,
  device: "d".repeat(32),
  name: "Player 1",
});

async function invite(admin: Browser, uses = 5) {
  const csrf = await admin.csrf("/admin");
  const html = await (await admin.post("/admin/invites", { csrf, uses: String(uses), days: "7" })).text();
  return /\/invite\/([A-Z0-9]+)/.exec(html)![1];
}

async function pair(phone: Browser, deviceName: string) {
  const start = await (await api("/api/pair/start", { device_name: deviceName })).json<any>();
  expect(start.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  expect(await (await api("/api/pair/poll", { poll: start.poll })).json()).toEqual({ status: "waiting" });
  const code = start.code.replace("-", "");
  expect(start.url).toBe(`${BASE}/pair/${code}`);
  const csrf = await phone.csrf(`/pair/${code}`);
  expect((await phone.post(`/pair/${code}`, { csrf })).status).toBe(302);
  const done = await (await api("/api/pair/poll", { poll: start.poll })).json<any>();
  expect(done.status).toBe("paired");
  // Handed over once.
  expect(await (await api("/api/pair/poll", { poll: start.poll })).json()).toEqual({ status: "expired" });
  return done.token as string;
}

describe("geow2-scores", () => {
  it("runs a group: invite, join, pair two devices, sync", async () => {
    const admin = new Browser();
    expect((await admin.post("/admin/login", { secret: "wrong" })).status).toBe(401);
    expect((await admin.post("/admin/login", { secret: "test admin secret" })).status).toBe(302);
    const code = await invite(admin);

    // Names: the game's font, at most 20 characters, unique.
    const phone = new Browser();
    expect((await phone.post(`/invite/${code}`, { name: "user@example" })).status).toBe(400);
    expect((await phone.post(`/invite/${code}`, { name: "x".repeat(21) })).status).toBe(400);
    expect((await phone.post(`/invite/${code}`, { name: "  Pilot   One " })).status).toBe(302);
    const welcome = await (await phone.fetch("/me")).text();
    expect(welcome).toContain("Pilot One");
    // The address to type into the game, without https:// (the game adds it).
    expect(welcome).toContain('value="scores.example"');
    const other = new Browser();
    expect((await other.post(`/invite/${code}`, { name: "PILOT ONE" })).status).toBe(400);
    expect((await other.post(`/invite/${code}`, { name: "Copilot" })).status).toBe(302);

    // Forms need the page's token.
    expect((await phone.post("/me/name", { name: "Sneaky" })).status).toBe(403);

    const pc = await pair(phone, "PC");
    const deck = await pair(phone, "Steam Deck");
    const friend = await pair(other, "Laptop");

    // The PC sends two games and its progress.
    const first = await (
      await api("/api/sync", {
        events: [event("a1", 0, 5000), event("a2", 5, 900), { id: "bad" }],
        progress: { unlocked: 2 | 1, millions: 0, progress: [400, 10, 0, 0, 0, 0], achievements: 0x10 },
        since: 0,
      }, pc)
    ).json<any>();
    expect(first.player.name).toBe("Pilot One");
    expect(first.group).toBe("Test Group");
    expect(first.events.map((e: any) => e.id)).toEqual([event("a1", 0, 0).id, event("a2", 0, 0).id]);
    expect(first.progress).toEqual({ unlocked: 3, millions: 0, progress: [400, 10, 0, 0, 0, 0], achievements: 0x10 });

    // The Deck gets them, adds its own (one repeated: counted once), and the
    // progress merges.
    const second = await (
      await api("/api/sync", {
        events: [event("a1", 0, 5000), event("b1", 0, 7000)],
        progress: { unlocked: 2 | 4, millions: 1, progress: [100, 300, 0, 0, 0, 0], achievements: 0x01 },
        since: 0,
      }, deck)
    ).json<any>();
    expect(second.events).toHaveLength(3);
    expect(second.progress).toEqual({ unlocked: 7, millions: 1, progress: [400, 300, 0, 0, 0, 0], achievements: 0x11 });

    // The PC asks only for what's new since its cursor.
    const third = await (await api("/api/sync", { events: [], progress: {}, since: first.cursor }, pc)).json<any>();
    expect(third.events.map((e: any) => e.score)).toEqual([7000]);

    // The friend's game; the boards hold each player's best per mode.
    await api("/api/sync", { events: [event("c1", 0, 6000)], progress: {}, since: 0 }, friend);
    const boards = (await (await api("/api/sync", { events: [], progress: {}, since: 0 }, pc)).json<any>()).boards;
    expect(boards[0].map((r: any) => [r.name, r.score])).toEqual([["Pilot One", 7000], ["Copilot", 6000]]);
    expect(boards[5].map((r: any) => r.score)).toEqual([900]);

    // Renaming shows on the boards.
    const csrf = await phone.csrf("/me");
    expect((await phone.post("/me/name", { csrf, name: "Ace" })).status).toBe(302);
    const renamed = (await (await api("/api/sync", { events: [], progress: {}, since: 0 }, pc)).json<any>()).boards;
    expect(renamed[0][0].name).toBe("Ace");

    // An unpaired device is turned away.
    expect((await api("/api/sync", { events: [] }, "not a token")).status).toBe(401);
    const me = await (await phone.fetch("/me")).text();
    const deckId = /\/me\/devices\/([0-9a-f]+)\/revoke/.exec(me)![1];
    expect((await phone.post(`/me/devices/${deckId}/revoke`, { csrf })).status).toBe(302);
    const revoked = await Promise.all([pc, deck].map(async (t) => (await api("/api/sync", { events: [] }, t)).status));
    expect(revoked.sort()).toEqual([200, 401]);
  });

  it("turns away expired invites, unknown codes and missing sessions", async () => {
    const admin = new Browser();
    await admin.post("/admin/login", { secret: "test admin secret" });
    const code = await invite(admin, 1);
    expect((await new Browser().post(`/invite/${code}`, { name: "Only One" })).status).toBe(302);
    expect((await new Browser().post(`/invite/${code}`, { name: "Second" })).status).toBe(404);
    expect((await new Browser().fetch("/pair/ABCDEFGH")).status).toBe(401);
    expect((await new Browser().fetch("/boards")).status).toBe(401);
    expect((await api("/api/pair/poll", { poll: "nothing" })).status).toBe(200);
  });
});
