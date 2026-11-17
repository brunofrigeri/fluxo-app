import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { describe, test } from "node:test";

/**
 * The routes the mobile app uses to invite and remove users, called over HTTP against a RUNNING web app
 * (CI and `npm run e2e:local` start one) and a real local Supabase. Skipped unless APP_URL and SUPABASE_TEST_* are set.
 */
const APP = process.env.APP_URL;
const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY;
const on = Boolean(APP && URL && ANON && SERVICE);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe("mobile user-management routes", { skip: !on && "APP_URL / SUPABASE_TEST_* not set" }, () => {
  async function person(role: "admin" | "instructor", studioId: string, modalityId?: string) {
    const admin = createClient(URL!, SERVICE!, opts);
    const email = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: "Teste-12345", email_confirm: true });
    if (error) throw error;
    await admin.from("profiles").insert({ id: data.user.id, email, name: "Teste Pessoa", role, studio_id: studioId });
    if (role === "instructor" && modalityId) await admin.from("user_modalities").insert({ user_id: data.user.id, modality_id: modalityId });
    const c = createClient(URL!, ANON!, opts);
    const { data: s, error: se } = await c.auth.signInWithPassword({ email, password: "Teste-12345" });
    if (se) throw se;
    return { id: data.user.id, token: s.session!.access_token, admin };
  }

  async function studio() {
    const admin = createClient(URL!, SERVICE!, opts);
    const { data: mods } = await admin.from("modalities").select("id, key");
    const pilates = mods!.find((m) => m.key === "pilates")!.id as string;
    const { data: st } = await admin.from("studios").insert({ name: `API ${Date.now()}` }).select("id").single();
    await admin.from("studio_modalities").insert({ studio_id: st!.id, modality_id: pilates });
    return { studioId: st!.id as string, pilates, admin };
  }

  const call = (path: string, token: string | null, init: { method: string; body?: unknown }) =>
    fetch(`${APP}${path}`, { method: init.method, redirect: "manual", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: init.body ? JSON.stringify(init.body) : undefined });

  test("no token: 401 from the route itself, not a redirect to /login", async () => {
    const r = await call("/api/users/invite", null, { method: "POST", body: { name: "A B", email: "a@example.test", role: "instructor", modalityIds: [] } });
    assert.equal(r.status, 401);
    assert.equal((await call("/api/users/00000000-0000-4000-8000-000000000000", null, { method: "DELETE" })).status, 401);
  });

  test("an instructor cannot invite or remove", async () => {
    const s = await studio();
    const ana = await person("instructor", s.studioId, s.pilates);
    const invite = await call("/api/users/invite", ana.token, { method: "POST", body: { name: "Nova Pessoa", email: `n-${Date.now()}@example.test`, role: "instructor", modalityIds: [s.pilates] } });
    assert.equal(invite.status, 400);
    assert.equal(((await invite.json()) as { error: string }).error, "Apenas administradores podem gerenciar usuários.");
    const other = await person("instructor", s.studioId, s.pilates);
    assert.equal((await call(`/api/users/${other.id}`, ana.token, { method: "DELETE" })).status, 400);
  });

  test("an admin invites someone into their own studio, with the ticked modalities", async () => {
    const s = await studio();
    const boss = await person("admin", s.studioId);
    const email = `invited-${Date.now()}@example.test`;
    const r = await call("/api/users/invite", boss.token, { method: "POST", body: { name: "Pessoa Convidada", email, role: "instructor", workingHours: "Seg a Sex", modalityIds: [s.pilates] } });
    assert.equal(r.status, 200, JSON.stringify(await r.clone().json().catch(() => ({}))));
    const { data: profile } = await boss.admin.from("profiles").select("id, name, role, studio_id, working_hours").eq("email", email).single();
    assert.equal(profile?.studio_id, s.studioId);
    assert.equal(profile?.role, "instructor");
    assert.equal(profile?.working_hours, "Seg a Sex");
    const { data: taught } = await boss.admin.from("user_modalities").select("modality_id").eq("user_id", profile!.id);
    assert.deepEqual(taught?.map((t) => t.modality_id), [s.pilates]);

    assert.equal(((await (await call("/api/users/invite", boss.token, { method: "POST", body: { name: "Pessoa Convidada", email, role: "instructor", modalityIds: [s.pilates] } })).json()) as { error: string }).error, "Já existe uma conta com este e-mail.");
    assert.equal(((await (await call("/api/users/invite", boss.token, { method: "POST", body: { name: "X", email: "nope", role: "instructor", modalityIds: [] } })).json()) as { error: string }).error, "Informe o nome.");
    assert.equal((await call("/api/users/invite", boss.token, { method: "POST", body: { name: "Sem Modalidade", email: `m-${Date.now()}@example.test`, role: "instructor", modalityIds: [] } })).status, 400);
  });

  test("an admin removes someone in their studio, never themselves, never another studio's people", async () => {
    const s = await studio();
    const boss = await person("admin", s.studioId);
    const victim = await person("instructor", s.studioId, s.pilates);
    assert.equal(((await (await call(`/api/users/${boss.id}`, boss.token, { method: "DELETE" })).json()) as { error: string }).error, "Você não pode remover a própria conta.");

    const foreign = await studio();
    const stranger = await person("instructor", foreign.studioId, foreign.pilates);
    assert.equal(((await (await call(`/api/users/${stranger.id}`, boss.token, { method: "DELETE" })).json()) as { error: string }).error, "Usuário não encontrado.");
    const { data: still } = await boss.admin.from("profiles").select("id").eq("id", stranger.id).maybeSingle();
    assert.ok(still, "the other studio's person is untouched");

    assert.equal((await call(`/api/users/${victim.id}`, boss.token, { method: "DELETE" })).status, 200);
    const { data: gone } = await boss.admin.from("profiles").select("id").eq("id", victim.id).maybeSingle();
    assert.equal(gone, null);
  });
});
