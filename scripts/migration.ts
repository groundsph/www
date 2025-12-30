import { generateId } from 'better-auth';
import { Pool } from 'pg';
import { auth } from '../lib/auth'; // Adjusted path
import { config } from 'dotenv';

config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    /**
     * Number of users to process in each batch
     * Higher values = faster migration but more memory usage
     * Recommended: 5000-10000 for most cases
     */
    batchSize: 1000, // Reduced from 5000 to be safe
    /**
     * Resume from a specific user ID (cursor-based pagination)
     * Useful for resuming interrupted migrations
     * Set to null to start from the beginning
     */
    resumeFromId: null as string | null,
    /**
     * Temporary email domain for phone-only users
     * Phone-only users need an email for Better Auth
     * Format: {phone_number}@{tempEmailDomain}
     */
    tempEmailDomain: 'temp.better-auth.com',
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
type MigrationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

type MigrationState = {
    status: MigrationStatus;
    totalUsers: number;
    processedUsers: number;
    successCount: number;
    failureCount: number;
    skipCount: number;
    currentBatch: number;
    totalBatches: number;
    startedAt: Date | null;
    completedAt: Date | null;
    lastProcessedId: string | null;
    errors: Array<{ userId: string; error: string }>;
};

type UserInsertData = {
    id: string;
    email: string | null;
    name: string;
    email_verified: boolean;
    created_at: string | null;
    updated_at: string | null;
    image?: string;
    [key: string]: any;
};

type AccountInsertData = {
    id: string;
    user_id: string;
    provider_id: string;
    account_id: string;
    password: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type SupabaseIdentityFromDB = {
    id: string;
    provider_id: string;
    user_id: string;
    identity_data: Record<string, any>;
    provider: string;
    last_sign_in_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    email: string | null;
};

type SupabaseUserFromDB = {
    instance_id: string | null;
    id: string;
    aud: string | null;
    role: string | null;
    email: string | null;
    encrypted_password: string | null;
    email_confirmed_at: string | null;
    invited_at: string | null;
    confirmation_token: string | null;
    confirmation_sent_at: string | null;
    recovery_token: string | null;
    recovery_sent_at: string | null;
    email_change_token_new: string | null;
    email_change: string | null;
    email_change_sent_at: string | null;
    last_sign_in_at: string | null;
    raw_app_meta_data: Record<string, any> | null;
    raw_user_meta_data: Record<string, any> | null;
    is_super_admin: boolean | null;
    created_at: string | null;
    updated_at: string | null;
    phone: string | null;
    phone_confirmed_at: string | null;
    phone_change: string | null;
    phone_change_token: string | null;
    phone_change_sent_at: string | null;
    confirmed_at: string | null;
    email_change_token_current: string | null;
    email_change_confirm_status: number | null;
    banned_until: string | null;
    reauthentication_token: string | null;
    reauthentication_sent_at: string | null;
    is_sso_user: boolean;
    deleted_at: string | null;
    is_anonymous: boolean;
    identities: SupabaseIdentityFromDB[];
};

// ============================================================================
// MIGRATION STATE MANAGER
// ============================================================================
class MigrationStateManager {
    private state: MigrationState = {
        status: 'idle',
        totalUsers: 0,
        processedUsers: 0,
        successCount: 0,
        failureCount: 0,
        skipCount: 0,
        currentBatch: 0,
        totalBatches: 0,
        startedAt: null,
        completedAt: null,
        lastProcessedId: null,
        errors: [],
    };

    start(totalUsers: number, batchSize: number) {
        this.state = {
            status: 'running',
            totalUsers,
            processedUsers: 0,
            successCount: 0,
            failureCount: 0,
            skipCount: 0,
            currentBatch: 0,
            totalBatches: Math.ceil(totalUsers / batchSize),
            startedAt: new Date(),
            completedAt: null,
            lastProcessedId: null,
            errors: [],
        };
    }

    updateProgress(
        processed: number,
        success: number,
        failure: number,
        skip: number,
        lastId: string | null,
    ) {
        this.state.processedUsers += processed;
        this.state.successCount += success;
        this.state.failureCount += failure;
        this.state.skipCount += skip;
        this.state.currentBatch++;
        if (lastId) {
            this.state.lastProcessedId = lastId;
        }
    }

    addError(userId: string, error: string) {
        if (this.state.errors.length < 100) {
            this.state.errors.push({ userId, error });
        }
    }

    complete() {
        this.state.status = 'completed';
        this.state.completedAt = new Date();
    }

    fail() {
        this.state.status = 'failed';
        this.state.completedAt = new Date();
    }

    getState(): MigrationState {
        return { ...this.state };
    }

    getProgress(): number {
        if (this.state.totalUsers === 0) return 0;
        return Math.round((this.state.processedUsers / this.state.totalUsers) * 100);
    }

    getETA(): string | null {
        if (!this.state.startedAt || this.state.processedUsers === 0) {
            return null;
        }
        const elapsed = Date.now() - this.state.startedAt.getTime();
        const avgTimePerUser = elapsed / this.state.processedUsers;
        const remainingUsers = this.state.totalUsers - this.state.processedUsers;
        const remainingMs = avgTimePerUser * remainingUsers;

        const seconds = Math.floor(remainingMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// ============================================================================
// DATABASE CONNECTIONS
// ============================================================================
// Ensure env vars are loaded
if (!process.env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL not set");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const fromDB = new Pool({
    connectionString: process.env.SUPABASE_DB_URL, // Using SUPABASE_DB_URL from .env.local
});

const toDB = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// ============================================================================
// BETTER AUTH VALIDATION
// ============================================================================
/**
 * Validates that the imported Better Auth instance meets migration requirements
 */
async function validateAuthConfig() {
    const ctx = await auth.$context;
    const errors: string[] = [];

    // Check emailAndPassword
    if (!ctx.options.emailAndPassword?.enabled) {
        errors.push('emailAndPassword.enabled must be true');
    }

    // Check required plugins
    const requiredPlugins = ['admin', 'anonymous', 'phone-number'];
    const plugins = ctx.options.plugins || [];
    const pluginIds = plugins.map((p: any) => p.id);

    for (const required of requiredPlugins) {
        if (!pluginIds.includes(required)) {
            errors.push(`Missing required plugin: ${required}`);
        }
    }

    // Check required additional fields
    const additionalFields = ctx.options.user?.additionalFields || {};
    // Note: Type definition uses 'any' here as DBFieldAttribute import might not be available or compatible
    const requiredFields: Record<string, any> = {
        userMetadata: { type: 'json', required: false, input: false },
        appMetadata: { type: 'json', required: false, input: false },
        invitedAt: { type: 'date', required: false, input: false },
        lastSignInAt: { type: 'date', required: false, input: false },
    };

    for (const [fieldName, expectedConfig] of Object.entries(requiredFields)) {
        const fieldConfig = additionalFields[fieldName];
        if (!fieldConfig) {
            errors.push(`Missing required user.additionalFields: ${fieldName}`);
        } else {
            // Validate field configuration
            if (fieldConfig.type !== expectedConfig.type) {
                errors.push(
                    `user.additionalFields.${fieldName} must have type: '${expectedConfig.type}' (got '${fieldConfig.type}')`,
                );
            }
            if (fieldConfig.required !== expectedConfig.required) {
                errors.push(
                    `user.additionalFields.${fieldName} must have required: ${expectedConfig.required}`,
                );
            }
            if (fieldConfig.input !== expectedConfig.input) {
                errors.push(`user.additionalFields.${fieldName} must have input: ${expectedConfig.input}`);
            }
        }
    }

    if (errors.length > 0) {
        console.error('\n🟧 Better Auth Configuration Errors:\n');
        errors.forEach((err) => console.error(` ${err}`));
        console.error('\n🟧 Please update your Better Auth configuration to include:\n');
        console.error(' 1. emailAndPassword: { enabled: true }');
        console.error(' 2. plugins: [admin(), anonymous(), phoneNumber()]');
        console.error(
            ' 3. user.additionalFields: { userMetadata, appMetadata, invitedAt, lastSignInAt }\n',
        );
        process.exit(1);
    }
    return ctx;
}

// ============================================================================
// MIGRATION LOGIC
// ============================================================================
const stateManager = new MigrationStateManager();
let ctxCache: {
    hasAnonymousPlugin: boolean;
    hasAdminPlugin: boolean;
    hasPhoneNumberPlugin: boolean;
    supportedProviders: string[];
} | null = null;

async function processBatch(
    users: SupabaseUserFromDB[],
    ctx: any,
): Promise<{
    success: number;
    failure: number;
    skip: number;
    errors: Array<{ userId: string; error: string }>;
}> {
    const stats = {
        success: 0,
        failure: 0,
        skip: 0,
        errors: [] as Array<{ userId: string; error: string }>,
    };

    if (!ctxCache) {
        ctxCache = {
            hasAdminPlugin: ctx.options.plugins?.some((p: any) => p.id === 'admin') || false,
            hasAnonymousPlugin: ctx.options.plugins?.some((p: any) => p.id === 'anonymous') || false,
            hasPhoneNumberPlugin: ctx.options.plugins?.some((p: any) => p.id === 'phone-number') || false,
            supportedProviders: Object.keys(ctx.options.socialProviders || {}),
        };
    }

    const { hasAdminPlugin, hasAnonymousPlugin, hasPhoneNumberPlugin, supportedProviders } = ctxCache;
    const validUsersData: Array<{ user: SupabaseUserFromDB; userData: UserInsertData }> = [];

    for (const user of users) {
        if (!user.email && !user.phone) {
            stats.skip++;
            continue;
        }

        if (!user.email && !hasPhoneNumberPlugin) {
            stats.skip++;
            continue;
        }

        if (user.deleted_at) {
            stats.skip++;
            continue;
        }

        if (user.banned_until && !hasAdminPlugin) {
            stats.skip++;
            continue;
        }

        const getTempEmail = (phone: string) => `${phone.replace(/[^0-9]/g, '')}@${CONFIG.tempEmailDomain}`;

        const getName = (): string => {
            if (user.raw_user_meta_data?.name) return user.raw_user_meta_data.name;
            if (user.raw_user_meta_data?.full_name) return user.raw_user_meta_data.full_name;
            if (user.raw_user_meta_data?.username) return user.raw_user_meta_data.username;
            if (user.raw_user_meta_data?.user_name) return user.raw_user_meta_data.user_name;
            const firstId = user.identities?.[0];
            if (firstId?.identity_data?.name) return firstId.identity_data.name;
            if (firstId?.identity_data?.full_name) return firstId.identity_data.full_name;
            if (firstId?.identity_data?.username) return firstId.identity_data.username;
            if (firstId?.identity_data?.preferred_username) return firstId.identity_data.preferred_username;
            if (user.email) return user.email.split('@')[0]!;
            if (user.phone) return user.phone;
            return 'Unknown';
        };

        const getImage = (): string | undefined => {
            if (user.raw_user_meta_data?.avatar_url) return user.raw_user_meta_data.avatar_url;
            if (user.raw_user_meta_data?.picture) return user.raw_user_meta_data.picture;
            const firstId = user.identities?.[0];
            if (firstId?.identity_data?.avatar_url) return firstId.identity_data.avatar_url;
            if (firstId?.identity_data?.picture) return firstId.identity_data.picture;
            return undefined;
        };

        const userData: UserInsertData = {
            id: user.id, // KEEPING SUPABASE UUID
            email: user.email || (user.phone ? getTempEmail(user.phone) : null),
            email_verified: !!user.email_confirmed_at,
            name: getName(),
            image: getImage(),
            created_at: user.created_at,
            updated_at: user.updated_at,
        };

        if (hasAnonymousPlugin) userData.is_anonymous = user.is_anonymous;

        if (hasPhoneNumberPlugin && user.phone) {
            userData.phone_number = user.phone;
            userData.phone_number_verified = !!user.phone_confirmed_at;
        }

        if (hasAdminPlugin) {
            userData.role = user.is_super_admin ? 'admin' : user.role || 'user';
            if (user.banned_until) {
                const banExpires = new Date(user.banned_until);
                if (banExpires > new Date()) {
                    userData.banned = true;
                    userData.ban_reason = 'Migrated from Supabase (banned)';
                    userData.ban_expires = banExpires;
                } else {
                    userData.banned = false;
                }
            } else {
                userData.banned = false;
            }
        }

        if (user.raw_user_meta_data && Object.keys(user.raw_user_meta_data).length > 0) {
            userData.user_metadata = user.raw_user_meta_data;
        }

        if (user.raw_app_meta_data && Object.keys(user.raw_app_meta_data).length > 0) {
            userData.app_metadata = user.raw_app_meta_data;
        }

        if (user.invited_at) userData.invited_at = user.invited_at;
        if (user.last_sign_in_at) userData.last_sign_in_at = user.last_sign_in_at;

        validUsersData.push({ user, userData });
    }

    if (validUsersData.length === 0) {
        return stats;
    }

    try {
        await toDB.query('BEGIN');

        const allFields = new Set<string>();
        validUsersData.forEach(({ userData }) => {
            Object.keys(userData).forEach((key) => allFields.add(key));
        });
        const fields = Array.from(allFields);

        // Insert Users
        const maxParamsPerQuery = 60000;
        const fieldsPerUser = fields.length;
        const usersPerChunk = Math.floor(maxParamsPerQuery / fieldsPerUser);

        for (let i = 0; i < validUsersData.length; i += usersPerChunk) {
            const chunk = validUsersData.slice(i, i + usersPerChunk);
            const placeholders: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            for (const { userData } of chunk) {
                const userPlaceholders = fields.map((field) => {
                    values.push(userData[field] ?? null);
                    return `$${paramIndex++}`;
                });
                placeholders.push(`(${userPlaceholders.join(', ')})`);
            }

            await toDB.query(
                `
        INSERT INTO "user" (${fields.map((f) => `"${f}"`).join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (id) DO NOTHING
      `,
                values,
            );
        }

        // Prepare Accounts
        const accountsData: AccountInsertData[] = [];
        for (const { user } of validUsersData) {
            // Email/Password Identity
            // If the user has an encrypted_password, we create a 'credential' account
            if (user.encrypted_password) {
                accountsData.push({
                    id: generateId(),
                    user_id: user.id,
                    provider_id: 'credential',
                    account_id: user.id, // Or email? Better Auth 'credential' usually doesn't strictly need accountId but often uses email or id
                    password: user.encrypted_password, // MIGRATING HASH
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                });
            }

            // Other identities (OAuth)
            for (const identity of user.identities ?? []) {
                if (identity.provider === 'email') continue; // Handled above

                if (supportedProviders.includes(identity.provider)) {
                    accountsData.push({
                        id: generateId(),
                        user_id: user.id,
                        provider_id: identity.provider,
                        account_id: identity.identity_data?.sub || identity.provider_id,
                        password: null,
                        created_at: identity.created_at ?? user.created_at,
                        updated_at: identity.updated_at ?? user.updated_at,
                    });
                }
            }
        }

        // Insert Accounts
        if (accountsData.length > 0) {
            const fieldsPerAccount = 7;
            const accountsPerChunk = Math.floor(maxParamsPerQuery / fieldsPerAccount);

            for (let i = 0; i < accountsData.length; i += accountsPerChunk) {
                const chunk = accountsData.slice(i, i + accountsPerChunk);
                const accountPlaceholders: string[] = [];
                const accountValues: any[] = [];
                let paramIndex = 1;

                for (const acc of chunk) {
                    accountPlaceholders.push(
                        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
                    );
                    accountValues.push(
                        acc.id,
                        acc.user_id,
                        acc.provider_id,
                        acc.account_id,
                        acc.password,
                        acc.created_at,
                        acc.updated_at,
                    );
                }

                await toDB.query(
                    `
          INSERT INTO "account" ("id", "user_id", "provider_id", "account_id", "password", "created_at", "updated_at")
          VALUES ${accountPlaceholders.join(', ')}
          ON CONFLICT ("id") DO NOTHING
        `,
                    accountValues,
                );
            }
        }

        await toDB.query('COMMIT');
        stats.success = validUsersData.length;
    } catch (error: any) {
        await toDB.query('ROLLBACK');
        console.error('[TRANSACTION] Batch failed, rolled back:', error.message);
        stats.failure = validUsersData.length;
        if (stats.errors.length < 100) {
            stats.errors.push({ userId: 'bulk', error: error.message });
        }
    }

    return stats;
}

async function migrateFromSupabase() {
    const { batchSize, resumeFromId } = CONFIG;
    console.log('[MIGRATION] Starting migration with config:', CONFIG);

    // Validate Better Auth configuration
    const ctx = await validateAuthConfig();

    try {
        const countResult = await fromDB.query<{ count: string }>(
            `
      SELECT COUNT(*) as count
      FROM auth.users
      ${resumeFromId ? 'WHERE id > $1' : ''}
    `,
            resumeFromId ? [resumeFromId] : [],
        );

        const totalUsers = parseInt(countResult.rows[0]?.count || '0', 10);
        console.log(`[MIGRATION] Starting migration for ${totalUsers.toLocaleString()} users`);
        console.log(`[MIGRATION] Batch size: ${batchSize}\n`);

        stateManager.start(totalUsers, batchSize);

        let lastProcessedId: string | null = resumeFromId;
        let hasMore = true;
        let batchNumber = 0;

        while (hasMore) {
            batchNumber++;
            const batchStart = Date.now();

            const result: { rows: SupabaseUserFromDB[] } = await fromDB.query<SupabaseUserFromDB>(
                `
        SELECT
          u.*,
          COALESCE(
            json_agg(
              i.* ORDER BY i.id
            ) FILTER (WHERE i.id IS NOT NULL),
            '[]'::json
          ) as identities
        FROM auth.users u
        LEFT JOIN auth.identities i ON u.id = i.user_id
        ${lastProcessedId ? 'WHERE u.id > $1' : ''}
        GROUP BY u.id
        ORDER BY u.id ASC
        LIMIT $${lastProcessedId ? '2' : '1'}
      `,
                lastProcessedId ? [lastProcessedId, batchSize] : [batchSize],
            );

            const batch: SupabaseUserFromDB[] = result.rows;
            hasMore = batch.length === batchSize;

            if (batch.length === 0) break;

            console.log(
                `\nBatch ${batchNumber}/${Math.ceil(totalUsers / batchSize)} (${batch.length} users)`,
            );

            const stats = await processBatch(batch, ctx);

            lastProcessedId = batch[batch.length - 1]!.id;
            stateManager.updateProgress(
                batch.length,
                stats.success,
                stats.failure,
                stats.skip,
                lastProcessedId,
            );

            stats.errors.forEach((err) => stateManager.addError(err.userId, err.error));

            const batchTime = ((Date.now() - batchStart) / 1000).toFixed(2);
            const usersPerSec = (batch.length / parseFloat(batchTime)).toFixed(0);

            const state = stateManager.getState();
            console.log(`Success: ${stats.success} | Skip: ${stats.skip} | Failure: ${stats.failure}`);
            console.log(
                `Progress: ${stateManager.getProgress()}% (${state.processedUsers.toLocaleString()}/${state.totalUsers.toLocaleString()})`,
            );
            console.log(`Speed: ${usersPerSec} users/sec (${batchTime}s for this batch)`);

            const eta = stateManager.getETA();
            if (eta) {
                console.log(`ETA: ${eta}`);
            }
        }

        stateManager.complete();
        const finalState = stateManager.getState();
        console.log('\n🎉 Migration completed');
        console.log(` - Success: ${finalState.successCount.toLocaleString()}`);
        console.log(` - Skipped: ${finalState.skipCount.toLocaleString()}`);
        console.log(` - Failed: ${finalState.failureCount.toLocaleString()}`);

        const totalTime =
            finalState.completedAt && finalState.startedAt
                ? ((finalState.completedAt.getTime() - finalState.startedAt.getTime()) / 1000 / 60).toFixed(
                    1,
                )
                : '0';

        console.log(` Total time: ${totalTime} minutes`);

        if (finalState.errors.length > 0) {
            console.log(`\nFirst ${Math.min(10, finalState.errors.length)} errors:`);
            finalState.errors.slice(0, 10).forEach((err) => {
                console.log(`- User ${err.userId}: ${err.error}`);
            });
        }

        return finalState;
    } catch (error) {
        stateManager.fail();
        console.error('\nMigration failed:', error);
        throw error;
    } finally {
        await fromDB.end();
        await toDB.end();
    }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================
async function main() {
    console.log('🚀 Supabase Auth → Better Auth Migration\n');

    if (!process.env.SUPABASE_DB_URL) {
        console.error('Error: SUPABASE_DB_URL environment variable is required');
        process.exit(1);
    }
    if (!process.env.DATABASE_URL) {
        console.error('Error: DATABASE_URL environment variable is required');
        process.exit(1);
    }

    try {
        await migrateFromSupabase();
        process.exit(0);
    } catch (error) {
        console.error('\nMigration failed:', error);
        process.exit(1);
    }
}

main();
