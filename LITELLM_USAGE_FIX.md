# LiteLLM Usage API Integration Fix

## Problem
The usage page wasn't displaying data because:
1. The LiteLLM `/user/daily/activity` endpoint doesn't accept `user_id` parameter
2. It requires the actual LiteLLM token ID (from the `token` field when listing keys)
3. The token ID wasn't being stored or retrieved anywhere in our system

## Solution Implemented

### 1. Added Token Lookup Method
**File**: `backend/src/services/litellm.service.ts`
- Added `getKeyTokenByAlias()` method to retrieve the LiteLLM token ID
- Calls `/key/list` with the user ID and searches for matching key alias
- Caches the result for performance

### 2. Updated getDailyActivity Method
**File**: `backend/src/services/litellm.service.ts`
- Changed from `getUserDailyActivity()` to `getDailyActivity()`
- Now accepts optional `apiKeyHash` (which is actually the token ID)
- Properly formats the API call with correct parameters:
  - `start_date`, `end_date`, `api_key` (the token ID)
- Correctly parses the LiteLLM response format with `results` and `metadata`

### 3. Updated Usage Stats Service
**File**: `backend/src/services/usage-stats.service.ts`
- Fetches the API key's name (alias) from database
- Calls `getKeyTokenByAlias()` to get the LiteLLM token ID
- Uses the token ID for the `/user/daily/activity` API call
- Properly transforms the response including daily metrics if available

## How It Works Now

1. User selects an API key in the frontend
2. Backend receives the API key ID
3. Service looks up the key's alias (name) from the database
4. Service calls LiteLLM `/key/list` to find the token ID for that alias
5. Service calls `/user/daily/activity` with the token ID
6. Data is transformed and returned to frontend

## Future Improvements

To make this more efficient, we should:

1. **Store Token ID**: When creating an API key, parse the response and store the `token` field
2. **Add Database Column**: Add `litellm_token_id` column to `api_keys` table
3. **Update Key Creation**: Modify the API key creation to save the token ID

This would eliminate the need for the `/key/list` lookup on every usage request.

## Testing

With these changes:
- The usage page should now display real data from LiteLLM
- Check backend logs for debug messages to verify the flow
- Ensure the API key has a proper alias/name that matches in LiteLLM