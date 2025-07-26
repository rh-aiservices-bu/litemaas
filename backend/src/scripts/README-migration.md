# Subscription Migration Scripts

This directory contains scripts for migrating the LiteMaaS subscription system from approval-based to self-service model.

## Migration Script: `migrate-subscriptions.ts`

### Purpose

Converts the subscription system from requiring manual approval to immediate activation:
- **From**: Users subscribe → status "pending" → manual approval → status "active"
- **To**: Users subscribe → status "active" immediately

### What It Does

1. **Converts Pending Subscriptions**: All existing "pending" subscriptions become "active"
2. **Removes Duplicates**: Eliminates duplicate user-model subscriptions (keeps most recent)
3. **Adds Constraints**: Prevents future duplicates with unique constraint
4. **Updates Defaults**: Changes default subscription status from "pending" to "active"
5. **Creates Indexes**: Adds performance indexes for the new workflow

### Usage

```bash
# Run the migration
npm run migrate:subscriptions

# Or directly with tsx
tsx src/scripts/migrate-subscriptions.ts
```

### Migration Status

**✅ COMPLETED**: This migration has already been executed on the database.

The script now serves as:
- **Documentation** of the changes made
- **Reference** for understanding the migration process
- **Rollback capability** if needed in emergency situations

### Functions Available

#### `migrateSubscriptionsToSelfService(fastify)`
Performs the main migration. Returns detailed results.

#### `rollbackSubscriptionMigration(fastify)`
⚠️ **USE WITH EXTREME CAUTION** - Reverts the migration changes.

#### `validateSubscriptionMigration(fastify)`
Checks the current state and validates migration success.

### Validation Checks

The script includes automatic validation:

```typescript
// Check 1: No pending subscriptions remain
SELECT COUNT(*) FROM subscriptions WHERE status = 'pending';

// Check 2: No duplicate subscriptions exist
SELECT user_id, model_id, COUNT(*) 
FROM subscriptions 
GROUP BY user_id, model_id 
HAVING COUNT(*) > 1;

// Check 3: Unique constraint is in place
// Check 4: Default status is 'active'
// Check 5: Status constraint excludes 'pending'
```

### Example Output

```
🚀 Starting subscription migration to self-service model
📝 Step 1: Converting pending subscriptions to active...
✅ Converted 15 pending subscriptions to active
🔍 Step 2: Identifying and removing duplicate subscriptions...
📊 Found 3 duplicate subscriptions to remove
🗑️ Removed 3 duplicate subscriptions
🔒 Step 3: Adding unique constraint for user-model subscriptions...
✅ Added unique constraint for user-model subscriptions
⚙️ Step 4: Updating default subscription status...
✅ Updated default subscription status to active
📋 Step 5: Updating status constraints...
✅ Updated status check constraint (removed pending)
📈 Step 6: Creating performance indexes...
✅ Created performance indexes
🔍 Step 7: Verifying migration results...
✅ Verification: No pending subscriptions remain
✅ Verification: No duplicate subscriptions remain
🎉 Subscription migration completed successfully in 1247ms
```

### Error Handling

The script includes comprehensive error handling:

- **Graceful failures**: Continues if non-critical steps fail
- **Detailed logging**: Logs each step and any issues
- **Rollback capability**: Can revert changes if needed
- **Validation**: Verifies results after completion

### Related Files

This migration is part of a larger refactor documented in:
- `../../../SUBSCRIPTION_REFACTOR_PLAN.md` - Complete implementation plan
- `../types/subscription.types.ts` - Type definitions (to be updated)
- `../services/subscription.service.ts` - Service logic (to be updated)
- `../routes/subscriptions.ts` - API routes (to be updated)

### Database Schema Changes

```sql
-- Main changes applied:
ALTER TABLE subscriptions 
ADD CONSTRAINT unique_user_model_subscription 
UNIQUE (user_id, model_id);

ALTER TABLE subscriptions 
ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_status_check 
CHECK (status IN ('active', 'suspended', 'cancelled', 'expired'));
```

### Monitoring

After migration, monitor:

- **Subscription creation success rate**
- **API error rates** (especially 409 conflicts from duplicate attempts)
- **User support tickets** about subscription status
- **Database constraint violation errors**

### Support

If you encounter issues:

1. **Check logs** for detailed error messages
2. **Run validation** to check current state
3. **Contact DevOps** for database-level issues
4. **Use rollback** only in emergency situations

### Security Notes

- Script requires database write permissions
- Creates constraints that prevent data inconsistency
- Logs all operations for audit trail
- Does not expose sensitive data in logs