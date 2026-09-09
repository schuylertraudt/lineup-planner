import { NextRequest, NextResponse } from "next/server";
import { requireTeamCoach } from "@/lib/auth";
import { applyMutation, SyncAuthError } from "@/lib/sync/apply";
import { Mutation } from "@/lib/sync/types";

export async function POST(req: NextRequest) {
  try {
    const coach = await requireTeamCoach();
    const { mutations } = (await req.json()) as { mutations: Mutation[] };
    if (!Array.isArray(mutations)) {
      return NextResponse.json({ error: "mutations must be an array" }, { status: 400 });
    }

    const results = [];
    for (const mutation of mutations) {
      try {
        const record = await applyMutation(mutation, coach.teamId, coach.id);
        results.push({ mutationId: mutation.id, entity: mutation.entity, ok: true, record });
      } catch (e) {
        if (e instanceof SyncAuthError) {
          results.push({ mutationId: mutation.id, entity: mutation.entity, ok: false, error: e.message });
        } else {
          results.push({ mutationId: mutation.id, entity: mutation.entity, ok: false, error: "apply failed" });
        }
      }
    }

    return NextResponse.json({ results, serverTime: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
