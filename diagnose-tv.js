#!/usr/bin/env node
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  console.log("\n📊 TV DATA DIAGNOSTIC\n");
  console.log("=".repeat(70));

  try {
    // Get all organizations
    const { data: organizations } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .order("created_at", { ascending: false })
      .limit(5);

    console.log("\n🏢 Organizations in database:");
    if (!organizations || organizations.length === 0) {
      console.log("   ❌ No organizations found!");
      process.exit(1);
    }

    organizations.forEach((org, i) => {
      console.log(`   ${i + 1}. ${org.name} (${org.slug})`);
      console.log(`      ID: ${org.id}\n`);
    });

    const orgId = organizations[0].id;
    console.log(`Using organization: ${organizations[0].name}\n`);

    // Check each table
    const tables = [
      { name: "tv_segments", label: "TV Segments" },
      { name: "tv_youtube_channels", label: "YouTube Channels" },
      { name: "tv_youtube_videos", label: "YouTube Videos" },
      { name: "tv_transcript_segments", label: "Transcript Segments" },
      { name: "tv_processing_logs", label: "Processing Logs" },
    ];

    console.log("📋 DATA IN TABLES:\n");

    for (const table of tables) {
      // Check if table exists and get row count
      const { data, error } = await supabase
        .from(table.name)
        .select("id, organization_id", { count: "exact" })
        .limit(1);

      if (error) {
        if (error.message.includes("relation") || error.message.includes("does not exist")) {
          console.log(`${table.label.padEnd(25)} ❌ TABLE DOES NOT EXIST`);
        } else {
          console.log(`${table.label.padEnd(25)} ⚠️  Error: ${error.message}`);
        }
        continue;
      }

      // Now get actual count
      const { count, error: countError } = await supabase
        .from(table.name)
        .select("id", { count: "exact" })
        .limit(0);

      if (countError) {
        console.log(`${table.label.padEnd(25)} ⚠️  Error checking count`);
        continue;
      }

      // Check how many match the organization
      const { count: orgCount, error: orgError } = await supabase
        .from(table.name)
        .select("id", { count: "exact" })
        .eq("organization_id", orgId)
        .limit(0);

      if (orgError && !orgError.message.includes("organization_id")) {
        console.log(`${table.label.padEnd(25)} ⚠️  Error: ${orgError.message}`);
        continue;
      }

      const totalRows = count || 0;
      const orgRows = orgCount || 0;

      if (totalRows === 0) {
        console.log(`${table.label.padEnd(25)} ❌ NO DATA (0 rows total)`);
      } else if (orgRows === 0) {
        console.log(
          `${table.label.padEnd(25)} ⚠️  ${totalRows} rows total, but 0 for your org`,
        );
        console.log(`   → Data exists but has wrong/NULL organization_id`);
      } else {
        console.log(`${table.label.padEnd(25)} ✅ ${orgRows} rows (org-specific)`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("\n💡 DIAGNOSIS:\n");

    // Count actual data
    const { count: segCount } = await supabase
      .from("tv_segments")
      .select("id", { count: "exact" })
      .eq("organization_id", orgId)
      .limit(0)
      .catch(() => ({ count: 0 }));

    const { count: chanCount } = await supabase
      .from("tv_youtube_channels")
      .select("id", { count: "exact" })
      .eq("organization_id", orgId)
      .limit(0)
      .catch(() => ({ count: 0 }));

    const { count: vidCount } = await supabase
      .from("tv_youtube_videos")
      .select("id", { count: "exact" })
      .eq("organization_id", orgId)
      .limit(0)
      .catch(() => ({ count: 0 }));

    if (segCount === 0 && chanCount === 0 && vidCount === 0) {
      console.log("❌ NO TV DATA AT ALL");
      console.log("\nYou haven't uploaded any TV data yet. You need to:");
      console.log("   1. Add YouTube channels via the TV Intelligence page");
      console.log("   2. Sync channels to download videos");
      console.log("   3. Process videos to generate transcripts");
      console.log("\nOR manually upload data with the correct organization_id.\n");
    } else {
      console.log(`✅ FOUND DATA:`);
      console.log(`   • TV Segments: ${segCount || 0}`);
      console.log(`   • YouTube Channels: ${chanCount || 0}`);
      console.log(`   • YouTube Videos: ${vidCount || 0}\n`);

      if (segCount === 0 && (chanCount > 0 || vidCount > 0)) {
        console.log("📌 NEXT STEP:");
        console.log("   You have channels/videos but no segments.");
        console.log("   Process videos to generate transcripts.\n");
      }
    }

    // Check for data with NULL organization_id
    console.log("\n🔍 CHECKING FOR ORPHANED DATA:\n");

    const { count: nullSegCount } = await supabase
      .from("tv_segments")
      .select("id", { count: "exact" })
      .is("organization_id", null)
      .limit(0)
      .catch(() => ({ count: 0 }));

    const { count: nullChanCount } = await supabase
      .from("tv_youtube_channels")
      .select("id", { count: "exact" })
      .is("organization_id", null)
      .limit(0)
      .catch(() => ({ count: 0 }));

    const { count: nullVidCount } = await supabase
      .from("tv_youtube_videos")
      .select("id", { count: "exact" })
      .is("organization_id", null)
      .limit(0)
      .catch(() => ({ count: 0 }));

    if (nullSegCount > 0 || nullChanCount > 0 || nullVidCount > 0) {
      console.log("⚠️  FOUND DATA WITH NULL organization_id:");
      if (nullSegCount > 0) console.log(`   • TV Segments: ${nullSegCount} rows`);
      if (nullChanCount > 0) console.log(`   • YouTube Channels: ${nullChanCount} rows`);
      if (nullVidCount > 0) console.log(`   • YouTube Videos: ${nullVidCount} rows`);
      console.log("\nRun: npm run fix:data\n");
    } else {
      console.log("✅ No orphaned data with NULL organization_id\n");
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
