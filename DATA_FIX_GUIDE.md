# 🔧 Data Display Fix - Complete Guide

## Problem Summary
Your data exists in the database but doesn't show on the frontend because:
- **All tables require `organization_id`** (influencers, mentions, narratives, etc.)
- **API filters by organization** - only returns data matching your organization
- **Your uploaded data is missing the correct `organization_id`**

## Solution: 3-Step Fix

### Step 1: Run the Diagnostic & Fix Script

```bash
npm run fix:data
```

This interactive script will:
1. ✅ Check database connection
2. 📋 List all your organizations
3. 🔎 Scan all tables for missing organization_id
4. 🔧 Fix the data automatically

**What to expect:**
```
🔍 Nucleus Data Diagnostic & Fix Tool
==================================================

📡 Checking database connection...
✅ Database connected!

📋 Available Organizations:

  1. Your Company Name (your-company)
     ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

Select organization number (1-1): 1

✅ Selected: Your Company Name

🔎 Scanning data...

Influencers          5 rows | ✅ 2 with org_id | ❌ 3 NULL org_id
Mentions             10 rows | ✅ 5 with org_id | ❌ 5 NULL org_id

⚠️  Found 8 rows missing organization_id

Fix these rows? (yes/no): yes

🔧 Fixing data...
✅ Influencers: Fixed 3 rows
✅ Mentions: Fixed 5 rows

✅ SUCCESS! Fixed 8 rows
```

### Step 2: Restart the Server

```bash
npm run dev:server
```

Or if running full stack:
```bash
npm run dev:full
```

### Step 3: Refresh Your Browser

- Go to `http://localhost:8080`
- Refresh the page (Ctrl+R or Cmd+R)
- **Your data should now appear!** ✨

---

## What Was Changed?

### New Files Added:
1. **`server/routes/diagnostic.js`** - Diagnostic API endpoints
2. **`fix-data.js`** - Interactive CLI script to scan and fix data

### Files Modified:
1. **`server/index.js`** - Added diagnostic routes
2. **`package.json`** - Added `fix:data` script

---

## How It Works

### The Issue (Before)
```javascript
// API Route: GET /api/influencers
const { data } = await supabaseAdmin
  .from("influencers")
  .select("*")
  .eq("organization_id", req.auth.organizationId)  // ← Filters by organization
  .order("followers", { ascending: false });

// Result: If your data has organization_id = NULL or wrong UUID
// → Returns 0 records ❌
```

### The Solution (After)
```javascript
// Script updates all rows:
UPDATE influencers 
SET organization_id = 'your-org-uuid'
WHERE organization_id IS NULL;

// Now when API queries:
// → Returns all your data ✅
```

---

## Troubleshooting

**Q: Script asks "Select organization" but shows nothing**
- You need to create an organization first
- Sign up on the app to create one

**Q: "SUPABASE_SERVICE_ROLE_KEY not configured"**
- Check `.env` file has `SUPABASE_SERVICE_ROLE_KEY` set
- It should be a long JWT token starting with `eyJ...`

**Q: Data still doesn't show after fix**
- Clear browser cache (DevTools → Application → Clear Storage)
- Check browser console for errors (F12 → Console)
- Verify backend is running: `http://localhost:5000/api/health`

**Q: Backend returns health check but no data**
- Check organization_id matches:
  ```bash
  # In browser console, after login:
  localStorage.getItem('nucleus-auth-token')
  # Decode this JWT to see organizationId
  ```

---

## Verify It's Working

### Method 1: Browser Console
After login, in browser DevTools (F12):
```javascript
// This should show your data
fetch('/api/influencers', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('nucleus-auth-token')}` }
}).then(r => r.json()).then(console.log)
```

### Method 2: Check /api/diagnostic
Visit: `http://localhost:5000/api/diagnostic/health`

Should show:
```json
{
  "database": "connected",
  "organizations": { "total": 1, "items": [...] },
  "influencers": { "total": 5, "issue": "All influencers have organization_id" },
  "mentions": { "total": 10, "issue": "All mentions have organization_id" }
}
```

---

## Next Steps

### Upload New Data Correctly
Instead of direct database inserts, use the API:

```javascript
// ✅ Correct Way - Auto-sets organization_id
const response = await fetch('http://localhost:5000/api/influencers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "John Doe",
    handle: "@johndoe",
    primaryPlatform: "Twitter/X",
    followers: 50000
  })
});
```

---

## Questions?

If data still doesn't show:
1. Run: `npm run fix:data` again
2. Check: `http://localhost:5000/api/diagnostic/health`
3. Share the output in DevTools console error
