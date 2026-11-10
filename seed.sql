-- ============================================================================
-- VRAJIX STUDIO — INITIAL ADMIN ACCOUNT SEED
-- Default Initial Credentials:
--   Username: admin
--   Password: VrajixAdmin2026!#
-- Hashing Algorithm: PBKDF2-HMAC-SHA256 (100,000 iterations, 256-bit key)
-- ============================================================================

INSERT OR IGNORE INTO admins (id, username, password_hash, salt, created_at)
VALUES (
    1,
    'admin',
    'dc9b66415a3687cc7589922ebbb9e2e14463814d0c0575a352c0a767fdeafb69',
    'ca71d2fa7d3a0064f283aab6e181c77d',
    CURRENT_TIMESTAMP
);
