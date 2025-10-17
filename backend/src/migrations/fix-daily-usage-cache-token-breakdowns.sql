-- Migration: Fix daily_usage_cache to include prompt_tokens and completion_tokens in user aggregations
-- Issue: The aggregated_by_user and aggregated_by_model.users fields are missing token breakdowns
-- This causes incorrect calculations when filtering by user in admin usage analytics

-- Create a temporary function to fix the JSON data
CREATE OR REPLACE FUNCTION fix_daily_usage_token_breakdowns()
RETURNS void AS $$
DECLARE
    cache_row RECORD;
    raw_data JSONB;
    aggregated_by_user JSONB;
    aggregated_by_model JSONB;
    fixed_by_user JSONB;
    fixed_by_model JSONB;
    user_id TEXT;
    user_data JSONB;
    model_name TEXT;
    model_data JSONB;
    model_metrics JSONB;
    user_model_metrics JSONB;
    total_prompt INTEGER;
    total_completion INTEGER;
    ratio NUMERIC;
    model_total INTEGER;
    model_prompt INTEGER;
    model_completion INTEGER;
    user_total INTEGER;
BEGIN
    -- Process each row in daily_usage_cache
    FOR cache_row IN
        SELECT date, raw_data, aggregated_by_user, aggregated_by_model
        FROM daily_usage_cache
    LOOP
        raw_data := cache_row.raw_data;
        aggregated_by_user := cache_row.aggregated_by_user;
        aggregated_by_model := cache_row.aggregated_by_model;

        fixed_by_user := aggregated_by_user;
        fixed_by_model := aggregated_by_model;

        -- Process each user
        FOR user_id, user_data IN
            SELECT * FROM jsonb_each(aggregated_by_user)
        LOOP
            total_prompt := 0;
            total_completion := 0;

            -- Process each model for this user
            IF user_data->>'models' IS NOT NULL THEN
                FOR model_name, user_model_metrics IN
                    SELECT * FROM jsonb_each(user_data->'models')
                LOOP
                    -- Get the model's total token breakdown from raw_data
                    model_metrics := raw_data->'breakdown'->'models'->model_name->'metrics';

                    IF model_metrics IS NOT NULL THEN
                        model_total := (model_metrics->>'total_tokens')::INTEGER;
                        model_prompt := (model_metrics->>'prompt_tokens')::INTEGER;
                        model_completion := (model_metrics->>'completion_tokens')::INTEGER;

                        -- Get this user's token count for this model
                        user_total := (user_model_metrics->'metrics'->>'total_tokens')::INTEGER;

                        -- Calculate proportional breakdown
                        IF model_total > 0 THEN
                            ratio := user_total::NUMERIC / model_total::NUMERIC;

                            -- Add prompt_tokens and completion_tokens to user's model metrics
                            fixed_by_user := jsonb_set(
                                fixed_by_user,
                                ARRAY[user_id, 'models', model_name, 'metrics', 'prompt_tokens'],
                                to_jsonb(FLOOR(model_prompt * ratio)::INTEGER)
                            );

                            fixed_by_user := jsonb_set(
                                fixed_by_user,
                                ARRAY[user_id, 'models', model_name, 'metrics', 'completion_tokens'],
                                to_jsonb(FLOOR(model_completion * ratio)::INTEGER)
                            );

                            -- Accumulate totals
                            total_prompt := total_prompt + FLOOR(model_prompt * ratio)::INTEGER;
                            total_completion := total_completion + FLOOR(model_completion * ratio)::INTEGER;
                        END IF;
                    END IF;
                END LOOP;
            END IF;

            -- Add total prompt_tokens and completion_tokens to user metrics
            fixed_by_user := jsonb_set(
                fixed_by_user,
                ARRAY[user_id, 'metrics', 'prompt_tokens'],
                to_jsonb(total_prompt)
            );

            fixed_by_user := jsonb_set(
                fixed_by_user,
                ARRAY[user_id, 'metrics', 'completion_tokens'],
                to_jsonb(total_completion)
            );
        END LOOP;

        -- Process each model's user breakdown
        FOR model_name, model_data IN
            SELECT * FROM jsonb_each(aggregated_by_model)
        LOOP
            -- Get the model's total token breakdown from raw_data
            model_metrics := raw_data->'breakdown'->'models'->model_name->'metrics';

            IF model_metrics IS NOT NULL THEN
                model_total := (model_metrics->>'total_tokens')::INTEGER;
                model_prompt := (model_metrics->>'prompt_tokens')::INTEGER;
                model_completion := (model_metrics->>'completion_tokens')::INTEGER;

                -- Process each user of this model
                IF model_data->>'users' IS NOT NULL THEN
                    FOR user_id, user_model_metrics IN
                        SELECT * FROM jsonb_each(model_data->'users')
                    LOOP
                        -- Get this user's token count for this model
                        user_total := (user_model_metrics->'metrics'->>'total_tokens')::INTEGER;

                        -- Calculate proportional breakdown
                        IF model_total > 0 THEN
                            ratio := user_total::NUMERIC / model_total::NUMERIC;

                            -- Add prompt_tokens and completion_tokens to model's user metrics
                            fixed_by_model := jsonb_set(
                                fixed_by_model,
                                ARRAY[model_name, 'users', user_id, 'metrics', 'prompt_tokens'],
                                to_jsonb(FLOOR(model_prompt * ratio)::INTEGER)
                            );

                            fixed_by_model := jsonb_set(
                                fixed_by_model,
                                ARRAY[model_name, 'users', user_id, 'metrics', 'completion_tokens'],
                                to_jsonb(FLOOR(model_completion * ratio)::INTEGER)
                            );
                        END IF;
                    END LOOP;
                END IF;
            END IF;
        END LOOP;

        -- Update the row with fixed JSON
        UPDATE daily_usage_cache
        SET
            aggregated_by_user = fixed_by_user,
            aggregated_by_model = fixed_by_model,
            updated_at = NOW()
        WHERE date = cache_row.date;

        RAISE NOTICE 'Fixed tokens for date: %', cache_row.date;
    END LOOP;

    RAISE NOTICE 'Migration complete: All daily_usage_cache entries have been updated with token breakdowns';
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT fix_daily_usage_token_breakdowns();

-- Drop the temporary function
DROP FUNCTION fix_daily_usage_token_breakdowns();

-- Verify the fix by checking a sample row
DO $$
DECLARE
    sample_user JSONB;
    sample_model JSONB;
BEGIN
    -- Get a sample user's metrics from aggregated_by_user
    SELECT
        value->'metrics'
    INTO sample_user
    FROM daily_usage_cache,
         jsonb_each(aggregated_by_user)
    WHERE value->'metrics'->>'total_tokens' IS NOT NULL
    LIMIT 1;

    IF sample_user IS NOT NULL THEN
        IF sample_user->>'prompt_tokens' IS NOT NULL THEN
            RAISE NOTICE 'Verification SUCCESS: User metrics now include prompt_tokens';
        ELSE
            RAISE WARNING 'Verification FAILED: User metrics still missing prompt_tokens';
        END IF;
    END IF;

    -- Get a sample model's user metrics from aggregated_by_model
    SELECT
        model_data->'users'->user_id->'metrics'
    INTO sample_model
    FROM daily_usage_cache,
         jsonb_each(aggregated_by_model) AS models(model_name, model_data),
         jsonb_object_keys(model_data->'users') AS user_id
    WHERE model_data->'users'->user_id->'metrics'->>'total_tokens' IS NOT NULL
    LIMIT 1;

    IF sample_model IS NOT NULL THEN
        IF sample_model->>'prompt_tokens' IS NOT NULL THEN
            RAISE NOTICE 'Verification SUCCESS: Model user metrics now include prompt_tokens';
        ELSE
            RAISE WARNING 'Verification FAILED: Model user metrics still missing prompt_tokens';
        END IF;
    END IF;
END;
$$;
