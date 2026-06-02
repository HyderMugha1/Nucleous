#!/usr/bin/env node
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import readline from "readline";

config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main() {
  console.log("\n🔍 Nucleus Data Diagnostic & Fix Tool\n");
  console.log("=".repeat(50));

  try {
    // Step 1: Check connection
    console.log("\n📡 Checking database connection...");
    const { data: orgs, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .limit(1);

    if (orgError) {
      console.error("❌ Database connection failed:", orgError.message);
      process.exit(1);
    }

    console.log("✅ Database connected!\n");

    // Step 2: List organizations
    console.log("📋 Available Organizations:\n");
    const { data: organizations } = await supabase.from("organizations").select("id, name, slug").order("created_at", { ascending: false });

    if (!organizations || organizations.length === 0) {
      console.log("❌ No organizations found. Please create one first.\n");
      rl.close();
      return;
    }

    organizations.forEach((org, index) => {
      console.log(`  ${index + 1}. ${org.name} (${org.slug})`);
      console.log(`     ID: ${org.id}\n`);
    });

    // Step 3: Let user choose organization
    const choice = await question(`Select organization number (1-${organizations.length}): `);
    const selectedOrg = organizations[parseInt(choice) - 1];

    if (!selectedOrg) {
      console.log("❌ Invalid selection");
      rl.close();
      return;
    }

    console.log(`\n✅ Selected: ${selectedOrg.name}\n`);

    // Step 4: Diagnose data
    console.log("🔎 Scanning data...\n");

    const tables = [
      { name: "influencers", label: "Influencers" },
      { name: "influencer_posts", label: "Influencer Posts" },
      { name: "mentions", label: "Mentions" },
      { name: "narratives", label: "Narratives" },
      { name: "campaigns", label: "Campaigns" },
      { name: "alert_rules", label: "Alert Rules" },
      { name: "alerts", label: "Alerts" },
      { name: "reports", label: "Reports" },
      { name: "tv_segments", label: "TV Segments" },
      { name: "tv_youtube_channels", label: "YouTube Channels" },
      { name: "tv_youtube_videos", label: "YouTube Videos" },
      { name: "tv_jobs", label: "TV Jobs" },
      { name: "tv_processing_logs", label: "TV Processing Logs" },
    ];

    const diagnostics = {};

    for (const table of tables) {
      const { data: rows } = await supabase.from(table.name).select("id, organization_id").limit(100);

      if (rows) {
        const withOrgId = rows.filter((r) => r.organization_id).length;
        const nullOrgId = rows.filter((r) => !r.organization_id).length;

        diagnostics[table.name] = {
          total: rows.length,
          withOrgId,
          nullOrgId,
        };

        console.log(
          `${table.label.padEnd(20)} ${rows.length} rows | ✅ ${withOrgId} with org_id | ❌ ${nullOrgId} NULL org_id`,
        );
      }
    }

    const totalNullOrgIds = Object.values(diagnostics).reduce((sum, item) => sum + item.nullOrgId, 0);

    if (totalNullOrgIds === 0) {
      console.log("\n✅ All data has organization_id set correctly!\n");
      rl.close();
      return;
    }

    console.log(`\n⚠️  Found ${totalNullOrgIds} rows missing organization_id\n`);

    // Step 5: Ask to fix
    const fix = await question("Fix these rows? (yes/no): ");

    if (fix.toLowerCase() !== "yes") {
      console.log("❌ Canceled\n");
      rl.close();
      return;
    }

    // Step 6: Fix data
    console.log(`\n🔧 Fixing data for organization: ${selectedOrg.name}...\n`);

    let totalFixed = 0;

    for (const table of tables) {
      const { data: updated, error } = await supabase
        .from(table.name)
        .update({ organization_id: selectedOrg.id })
        .is("organization_id", null)
        .select("id");

      if (error) {
        // Silently skip if table doesn't exist (like tv_processing_logs on older migrations)
        if (error.message.includes("relation") || error.message.includes("does not exist")) {
          // Table doesn't exist, skip
        } else {
          console.log(`❌ ${table.label}: ${error.message}`);
        }
      } else {
        const count = updated?.length || 0;
        if (count > 0) {
          console.log(`✅ ${table.label}: Fixed ${count} rows`);
          totalFixed += count;
        }
      }
    }

    console.log(`\n✅ SUCCESS! Fixed ${totalFixed} rows\n`);
    console.log("=".repeat(50));
    console.log("✨ Your data should now be visible on the frontend!");
    console.log("   - Restart your server: npm run dev:server");
    console.log("   - Refresh your browser\n");
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
