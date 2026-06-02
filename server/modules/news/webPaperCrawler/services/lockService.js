import { supabaseAdmin } from "../../../../supabase.js";

export async function acquireCrawlLock(organizationId, lockKey, expiresInMinutes = 20) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString();

  const { data: existing, error } = await supabaseAdmin
    .from("web_paper_crawl_locks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lock_key", lockKey)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!existing) {
    const { data, error: insertError } = await supabaseAdmin
      .from("web_paper_crawl_locks")
      .insert({
        organization_id: organizationId,
        lock_key: lockKey,
        is_locked: true,
        locked_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (insertError || !data) return false;
    return true;
  }

  if (existing.is_locked && existing.expires_at && new Date(existing.expires_at).getTime() > now.getTime()) {
    return false;
  }

  const { data: claimed } = await supabaseAdmin
    .from("web_paper_crawl_locks")
    .update({
      is_locked: true,
      locked_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .eq("id", existing.id)
    .or(`is_locked.eq.false,expires_at.lte.${now.toISOString()}`)
    .select("*")
    .single();

  return Boolean(claimed);
}

export async function releaseCrawlLock(organizationId, lockKey) {
  const { error } = await supabaseAdmin
    .from("web_paper_crawl_locks")
    .update({
      is_locked: false,
      expires_at: null,
    })
    .eq("organization_id", organizationId)
    .eq("lock_key", lockKey);
  if (error) throw new Error(error.message);
}
