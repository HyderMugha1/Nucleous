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
  console.log("\n📺 TV Data Setup - Auto Populate\n");
  console.log("=".repeat(70));

  try {
    // Get user's organization
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .order("created_at", { ascending: false })
      .limit(1);

    if (orgError || !organizations || organizations.length === 0) {
      console.log("\n❌ No organization found. Please sign up first.");
      console.log("   Go to http://localhost:8080 and create an account.\n");
      process.exit(1);
    }

    const orgId = organizations[0].id;
    const orgName = organizations[0].name;

    console.log(`\n🏢 Using Organization: ${orgName}`);
    console.log(`   ID: ${orgId}\n`);

    // Sample TV segments data
    const tvSegmentsData = [
      {
        organization_id: orgId,
        channel: "Geo News",
        show_name: "Jeo Pakistan",
        anchor_name: "Kamran Khan",
        headline: "Government announces new economic policy",
        transcript_snippet:
          "The government has announced a new economic policy aimed at improving growth and reducing inflation.",
        language: "ur",
        sentiment_label: "neutral",
        sentiment_score: 0.5,
        aired_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        organization_id: orgId,
        channel: "ARY News",
        show_name: "ARY Breaking News",
        anchor_name: "Mehrish Hayat",
        headline: "Major infrastructure project begins construction",
        transcript_snippet:
          "Construction has officially begun on the mega infrastructure project connecting three provinces.",
        language: "ur",
        sentiment_label: "positive",
        sentiment_score: 0.8,
        aired_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        organization_id: orgId,
        channel: "Samaa TV",
        show_name: "Awaz Pakistan",
        anchor_name: "Wajahat Khan",
        headline: "Stock market reaches new highs",
        transcript_snippet:
          "The Pakistan stock exchange hit new record highs today, up 2.5% in trading.",
        language: "ur",
        sentiment_label: "positive",
        sentiment_score: 0.85,
        aired_at: new Date(Date.now() - 10800000).toISOString(),
      },
      {
        organization_id: orgId,
        channel: "Dunya News",
        show_name: "Dunya Report",
        anchor_name: "Jasmeen Khan",
        headline: "Weather alert issued for monsoon season",
        transcript_snippet:
          "The meteorological department has issued a weather alert as monsoon season approaches.",
        language: "ur",
        sentiment_label: "negative",
        sentiment_score: 0.3,
        aired_at: new Date(Date.now() - 14400000).toISOString(),
      },
      {
        organization_id: orgId,
        channel: "Express News",
        show_name: "Express Tonight",
        anchor_name: "Hasan Iqbal",
        headline: "Education ministry releases new curriculum",
        transcript_snippet:
          "The education ministry has released an updated curriculum for schools across the nation.",
        language: "ur",
        sentiment_label: "neutral",
        sentiment_score: 0.5,
        aired_at: new Date(Date.now() - 18000000).toISOString(),
      },
      {
        organization_id: orgId,
        channel: "Bol News",
        show_name: "Bol Rishta",
        anchor_name: "Faisal Qureshi",
        headline: "Startup ecosystem grows in tech sector",
        transcript_snippet:
          "Pakistan's startup ecosystem has shown remarkable growth with record funding rounds.",
        language: "ur",
        sentiment_label: "positive",
        sentiment_score: 0.75,
        aired_at: new Date(Date.now() - 21600000).toISOString(),
      },
      {
        organization_id: orgId,
        channel: "Hum News",
        show_name: "Hum Suno Pakistan",
        anchor_name: "Imran Riaz Khan",
        headline: "Trade deficit narrows in recent months",
        transcript_snippet:
          "Pakistan's trade deficit has narrowed significantly compared to the same period last year.",
        language: "ur",
        sentiment_label: "positive",
        sentiment_score: 0.7,
        aired_at: new Date(Date.now() - 25200000).toISOString(),
      },
      {
        organization_id: orgId,
        channel: "92 News",
        show_name: "92 Breaking News",
        anchor_name: "Rana Mubashir",
        headline: "Healthcare initiative reaches rural areas",
        transcript_snippet:
          "A nationwide healthcare initiative has successfully expanded to remote rural regions.",
        language: "ur",
        sentiment_label: "positive",
        sentiment_score: 0.8,
        aired_at: new Date(Date.now() - 28800000).toISOString(),
      },
    ];

    console.log("📥 Inserting TV Segments...\n");

    const { data: insertedSegments, error: segmentError } = await supabase
      .from("tv_segments")
      .insert(tvSegmentsData)
      .select("id, channel, headline");

    if (segmentError) {
      console.log(`❌ Error inserting TV segments: ${segmentError.message}`);
      process.exit(1);
    }

    console.log(`✅ Created ${insertedSegments?.length || 0} TV segments\n`);
    insertedSegments?.forEach((seg, i) => {
      console.log(`   ${i + 1}. ${seg.channel} - ${seg.headline}`);
    });

    // Create sample YouTube channels
    console.log("\n📥 Creating YouTube Channels...\n");

    const youtubeChannelsData = [
      {
        organization_id: orgId,
        youtube_channel_id: "UCJrblLa40a7d64o_v-8B6Bg",
        channel_name: "Geo News Pakistan",
        thumbnail_url: "https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj",
        channel_url: "https://www.youtube.com/@geonewspakistan",
        status: "active",
      },
      {
        organization_id: orgId,
        youtube_channel_id: "UCIlqH-5W6fhcr5_uLl8Qzuw",
        channel_name: "ARY News",
        thumbnail_url: "https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj",
        channel_url: "https://www.youtube.com/@arynewspakistan",
        status: "active",
      },
      {
        organization_id: orgId,
        youtube_channel_id: "UCH2g-nKDXBwZhE0n3LZQmjA",
        channel_name: "Samaa TV",
        thumbnail_url: "https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj",
        channel_url: "https://www.youtube.com/@samaatv",
        status: "active",
      },
    ];

    const { data: insertedChannels, error: channelError } = await supabase
      .from("tv_youtube_channels")
      .insert(youtubeChannelsData)
      .select("id, channel_name");

    if (channelError) {
      if (channelError.message.includes("unique")) {
        console.log("⚠️  Some YouTube channels already exist (skipped duplicates)\n");
      } else {
        console.log(`❌ Error creating channels: ${channelError.message}`);
      }
    } else {
      console.log(`✅ Created ${insertedChannels?.length || 0} YouTube channels\n`);
      insertedChannels?.forEach((ch, i) => {
        console.log(`   ${i + 1}. ${ch.channel_name}`);
      });
    }

    // Get created channels for video insertion
    const { data: existingChannels } = await supabase
      .from("tv_youtube_channels")
      .select("id, channel_name")
      .eq("organization_id", orgId)
      .limit(3);

    if (existingChannels && existingChannels.length > 0) {
      console.log("\n📥 Creating Sample YouTube Videos...\n");

      const youtubeVideosData = [
        {
          organization_id: orgId,
          channel_id: existingChannels[0].id,
          youtube_video_id: "dQw4w9WgXcQ",
          title: "Latest Breaking News Update",
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
          youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          published_at: new Date(Date.now() - 86400000).toISOString(),
          duration_iso: "PT10M30S",
          duration_seconds: 630,
          processing_status: "completed",
          transcript_text: "Sample transcript for first video",
        },
        {
          organization_id: orgId,
          channel_id: existingChannels[0].id,
          youtube_video_id: "jNQXAC9IVRw",
          title: "Economic Update and Market Analysis",
          thumbnail_url: "https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg",
          youtube_url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
          published_at: new Date(Date.now() - 172800000).toISOString(),
          duration_iso: "PT15M45S",
          duration_seconds: 945,
          processing_status: "completed",
          transcript_text: "Sample transcript for second video",
        },
        {
          organization_id: orgId,
          channel_id: existingChannels[1].id,
          youtube_video_id: "9bZkp7q19f0",
          title: "Government Policy Discussion",
          thumbnail_url: "https://i.ytimg.com/vi/9bZkp7q19f0/default.jpg",
          youtube_url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
          published_at: new Date(Date.now() - 259200000).toISOString(),
          duration_iso: "PT12M20S",
          duration_seconds: 740,
          processing_status: "pending",
        },
      ];

      const { data: insertedVideos, error: videoError } = await supabase
        .from("tv_youtube_videos")
        .insert(youtubeVideosData)
        .select("id, title");

      if (videoError) {
        if (videoError.message.includes("unique")) {
          console.log("⚠️  Some videos already exist (skipped duplicates)\n");
        } else {
          console.log(`⚠️  Error creating videos: ${videoError.message}`);
        }
      } else {
        console.log(`✅ Created ${insertedVideos?.length || 0} sample videos\n`);
        insertedVideos?.forEach((vid, i) => {
          console.log(`   ${i + 1}. ${vid.title}`);
        });
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("\n✨ TV DATA SETUP COMPLETE!\n");
    console.log("Next steps:");
    console.log("  1. Restart your backend: npm run dev:server");
    console.log("  2. Open http://localhost:8080");
    console.log("  3. Go to TV Intelligence page");
    console.log("  4. See your data! 📺\n");
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
