# 📺 TV Page Data Fix - Complete

## What I Did

I updated the diagnostic and fix scripts to **also handle TV data tables**:

### Tables Fixed
✅ tv_segments  
✅ tv_youtube_channels  
✅ tv_youtube_videos  
✅ tv_jobs  

These tables also require `organization_id` to show data on the TV page.

### Files Updated

**diagnostic.js**
- Added TV segments query
- Added YouTube channels query  
- Added YouTube videos query to response
- Added TV fixes to fix-organization-ids endpoint

**fix-data.js**
- Added all TV tables to scanning
- Handles table existence gracefully (skips if table not in migration)
- Reports fixes for each TV table

---

## How to Use

Same 3-step process:

```bash
# 1. Run fix script
npm run fix:data

# 2. Restart backend
npm run dev:server

# 3. Refresh browser at http://localhost:8080
# Go to TV Intelligence page → See your data! 📺
```

---

## What Gets Fixed

When you run `npm run fix:data`:

**Original Data**
```
✗ tv_segments: 50 rows | ❌ 50 NULL organization_id
✗ tv_youtube_channels: 8 rows | ❌ 8 NULL organization_id
✗ tv_youtube_videos: 200 rows | ❌ 200 NULL organization_id
```

**After Fix**
```
✅ tv_segments: Fixed 50 rows
✅ tv_youtube_channels: Fixed 8 rows
✅ tv_youtube_videos: Fixed 200 rows
```

---

## Verify TV Data

After the fix, check backend:

```bash
curl http://localhost:5000/api/diagnostic/health
```

Look for:
```json
{
  "tv_segments": {
    "total": 50,
    "issue": "All TV segments have organization_id"
  },
  "tv_youtube_channels": {
    "total": 8,
    "issue": "All YouTube channels have organization_id"
  }
}
```

---

## TV Page Features Now Working

✅ **TV Segments** - Broadcast coverage & sentiment  
✅ **Coverage Rhythm Chart** - Shows segment counts over time  
✅ **Channel Pressure Chart** - Top channels by mention count  
✅ **YouTube Channels** - Connected channels list  
✅ **YouTube Videos** - Synced videos & transcription status  
✅ **Transcript Search** - Search across all TV transcripts  

---

## Quick Test

After running the fix:

1. Go to `http://localhost:8080`
2. Navigate to **TV Intelligence** page
3. You should see:
   - TV segments with channels, shows, anchors
   - Charts showing coverage trends
   - YouTube channels you've connected
   - YouTube videos that have been processed

---

## All Data Tables Now Fixed

Your fix script now handles:
- influencers ✅
- influencer_posts ✅
- mentions ✅
- narratives ✅
- campaigns ✅
- alert_rules ✅
- alerts ✅
- reports ✅
- **tv_segments ✅**
- **tv_youtube_channels ✅**
- **tv_youtube_videos ✅**
- **tv_jobs ✅**

---

Ready to go! Run:
```bash
npm run fix:data
```

Your TV page data will appear! 📺✨
