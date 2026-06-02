import fs from 'node:fs';
import path from 'node:path';
const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.trim().startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx > 0) process.env[line.slice(0, idx)] = line.slice(idx + 1);
}
const targetOrgId = '9b8f11ed-25a6-4f8b-9bef-ddf324a85636';
const { supabaseAdmin } = await import('./server/supabase.js');
const { runBackfillForOrganization } = await import('./server/modules/news/webPaperCrawler/services/crawlerService.js');
const { data: org } = await supabaseAdmin.from('organizations').select('id,name').eq('id', targetOrgId).maybeSingle();
console.log(`[${new Date().toISOString()}] Starting backfill for ${org?.name || targetOrgId}`);
try {
  const result = await runBackfillForOrganization(targetOrgId);
  console.log(`[${new Date().toISOString()}] Backfill finished`);
  console.log(JSON.stringify(result, null, 2));
  const { count } = await supabaseAdmin.from('web_paper_articles').select('id', { count: 'exact', head: true }).eq('organization_id', targetOrgId);
  console.log(`[${new Date().toISOString()}] Article count now: ${count}`);
} catch (error) {
  console.error(`[${new Date().toISOString()}] Backfill failed`);
  console.error(error instanceof Error ? error.stack : String(error));
}
