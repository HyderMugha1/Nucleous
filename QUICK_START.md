# ⚡ Quick Start - Fix Your Data Now!

## TL;DR - 3 Commands

```bash
# 1. Run the fix script (interactive, takes 30 seconds)
npm run fix:data

# 2. Restart the server
npm run dev:server

# 3. Refresh browser at http://localhost:8080
```

That's it! Your data will appear. ✨

---

## What I Fixed For You

I analyzed your entire codebase and found the root cause:

### The Problem
- Your database has `organization_id` column on every table
- The API filters data by `organization_id` 
- Your uploaded data doesn't have the correct `organization_id` set
- Result: Frontend requests data → API returns 0 rows → Frontend shows nothing

### The Solution
I created:
1. **`server/routes/diagnostic.js`** - New diagnostic API endpoints
2. **`fix-data.js`** - Interactive script that:
   - Connects to your database
   - Shows all organizations
   - Scans for broken data
   - Fixes it automatically
3. **Updated `package.json`** - Added `npm run fix:data` command
4. **Updated `server/index.js`** - Registered new diagnostic routes

---

## How to Use

### Option A: Automatic Fix (Recommended)
```bash
npm run fix:data
```

The script is interactive:
```
🔍 Nucleus Data Diagnostic & Fix Tool

📋 Available Organizations:
  1. Your Company (your-org-slug)
     ID: 12345678-abcd-...

Select organization number (1-1): 1
✅ Selected: Your Company

🔎 Scanning data...
Influencers: 5 rows | ✅ 2 with org_id | ❌ 3 NULL org_id
Mentions: 10 rows | ✅ 5 with org_id | ❌ 5 NULL org_id

Fix these rows? (yes/no): yes
✅ Influencers: Fixed 3 rows
✅ Mentions: Fixed 5 rows
✅ SUCCESS! Fixed 8 rows
```

### Option B: Manual HTTP Request
```bash
# 1. Check diagnosis
curl http://localhost:5000/api/diagnostic/health

# 2. Fix data (replace UUID with your org ID)
curl -X POST http://localhost:5000/api/diagnostic/fix-organization-ids \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "your-org-uuid-here"}'
```

---

## After Running Fix

```bash
# Restart server (if it was running)
npm run dev:server

# Or run full stack
npm run dev:full
```

Then:
1. Go to `http://localhost:8080`
2. Refresh the page
3. Login if needed
4. **Data will appear!** ✨

---

## Files Changed

### Created:
- ✨ `server/routes/diagnostic.js` - 180 lines
- ✨ `fix-data.js` - 220 lines  
- 📖 `DATA_FIX_GUIDE.md` - Complete guide
- 📖 `QUICK_START.md` - This file

### Modified:
- 🔧 `server/index.js` - Added diagnostic routes import
- 🔧 `package.json` - Added `fix:data` script

---

## Verify It Works

### Check Backend
```bash
curl http://localhost:5000/api/health
# Should respond with: {"status":"ok"}

curl http://localhost:5000/api/diagnostic/health
# Shows organizations, influencers, mentions counts
```

### Check Frontend
After login, open DevTools (F12) → Console:
```javascript
// Should return data now
fetch('/api/influencers', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('nucleus-auth-token')}` }
}).then(r => r.json()).then(d => console.log(d.items))
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "SUPABASE_SERVICE_ROLE_KEY not configured" | Check `.env` file - make sure it's in the root directory |
| Script shows no organizations | You need to create an organization - sign up in the app first |
| Data still missing after fix | Clear browser cache: DevTools → Application → Clear Storage → Refresh |
| API returns 401 errors | Make sure you're logged in and have the auth token |

---

## Next: Prevent This in Future

When uploading data, always use the API (not direct DB):
```javascript
// ✅ Correct - organization_id is set automatically
POST /api/influencers
{
  "name": "John Doe",
  "handle": "@johndoe",
  "primaryPlatform": "Twitter/X"
}

// ❌ Wrong - Direct DB insert misses organization_id
INSERT INTO influencers (name, handle, primary_platform) VALUES (...)
```

---

## Need Help?

1. **Run diagnostic**: `npm run fix:data`
2. **Check backend**: `curl http://localhost:5000/api/diagnostic/health`
3. **Check frontend DevTools**: F12 → Console → Check for errors
4. **Read full guide**: See `DATA_FIX_GUIDE.md`

---

Good luck! 🚀
