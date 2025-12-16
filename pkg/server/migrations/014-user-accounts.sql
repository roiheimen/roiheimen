-- Migration 014: User Accounts Foundation
-- Creates tables, JWT type, and authentication functions for email-based user registration

-- ============================================================================
-- JWT Type for User Authentication (separate from existing meeting-scoped JWT)
-- ============================================================================

CREATE TYPE roiheimen.user_jwt_token AS (
  role text,
  user_id integer,
  exp bigint
);

-- ============================================================================
-- Tables
-- ============================================================================

-- user_account: Global user accounts (not meeting-specific)
CREATE TABLE roiheimen.user_account (
  id               SERIAL PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE CHECK (email ~* '^.+@.+\..+$'),
  name             TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) < 128),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE roiheimen.user_account IS 'Global user accounts with email-based authentication';

CREATE INDEX ON roiheimen.user_account(email);
CREATE INDEX ON roiheimen.user_account(created_at);

-- user_credentials: Private credentials and verification status
CREATE TABLE roiheimen_private.user_credentials (
  user_id          INTEGER PRIMARY KEY REFERENCES roiheimen.user_account(id) ON DELETE CASCADE,
  password_hash    TEXT NOT NULL,
  email_verified   BOOLEAN DEFAULT FALSE,
  failed_attempts  INTEGER DEFAULT 0,
  first_failed_at  TIMESTAMPTZ DEFAULT NULL
);
COMMENT ON TABLE roiheimen_private.user_credentials IS 'Private credentials for user accounts';

-- email_verification: Tokens for email verification
CREATE TABLE roiheimen_private.email_verification (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES roiheimen.user_account(id) ON DELETE CASCADE,
  token            TEXT NOT NULL UNIQUE,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at          TIMESTAMPTZ DEFAULT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE roiheimen_private.email_verification IS 'Email verification tokens';

CREATE INDEX ON roiheimen_private.email_verification(user_id);
CREATE INDEX ON roiheimen_private.email_verification(token);
CREATE INDEX ON roiheimen_private.email_verification(expires_at);

-- password_reset: Tokens for password reset
CREATE TABLE roiheimen_private.password_reset (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES roiheimen.user_account(id) ON DELETE CASCADE,
  token            TEXT NOT NULL UNIQUE,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  used_at          TIMESTAMPTZ DEFAULT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE roiheimen_private.password_reset IS 'Password reset tokens';

CREATE INDEX ON roiheimen_private.password_reset(user_id);
CREATE INDEX ON roiheimen_private.password_reset(token);
CREATE INDEX ON roiheimen_private.password_reset(expires_at);

-- user_session: Login session tracking
CREATE TABLE roiheimen_private.user_session (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES roiheimen.user_account(id) ON DELETE CASCADE,
  login_at         TIMESTAMPTZ DEFAULT now(),
  logout_at        TIMESTAMPTZ DEFAULT NULL
);
COMMENT ON TABLE roiheimen_private.user_session IS 'User login session tracking';

CREATE INDEX ON roiheimen_private.user_session(user_id);
CREATE INDEX ON roiheimen_private.user_session(logout_at);

-- ============================================================================
-- Functions
-- ============================================================================

-- register_user: Create new user account with email verification token
-- Returns the verification token that should be emailed to the user
CREATE TYPE roiheimen.register_user_result AS (
  user_id INTEGER,
  verification_token TEXT
);

CREATE OR REPLACE FUNCTION roiheimen.register_user(
  email TEXT,
  password TEXT,
  name TEXT
) RETURNS roiheimen.register_user_result AS $$
DECLARE
  new_user roiheimen.user_account;
  verification_token TEXT;
BEGIN
  -- Validate password strength (minimum 8 characters)
  IF char_length(password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long';
  END IF;

  -- Create user account
  INSERT INTO roiheimen.user_account (email, name)
    VALUES (lower(trim(email)), trim(name))
    RETURNING * INTO new_user;

  -- Create credentials
  INSERT INTO roiheimen_private.user_credentials (user_id, password_hash)
    VALUES (new_user.id, crypt(password, gen_salt('bf')));

  -- Generate verification token (14-char hex)
  verification_token := encode(gen_random_bytes(7), 'hex');

  -- Create email verification record
  INSERT INTO roiheimen_private.email_verification (user_id, token)
    VALUES (new_user.id, verification_token);

  RETURN (new_user.id, verification_token)::roiheimen.register_user_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION roiheimen.register_user(TEXT, TEXT, TEXT) IS 'Registers a new user account and returns a verification token to be emailed';

-- verify_email: Mark email as verified using token
CREATE OR REPLACE FUNCTION roiheimen.verify_email(
  token TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  verification roiheimen_private.email_verification;
BEGIN
  -- Find valid, unused token
  SELECT * INTO verification
    FROM roiheimen_private.email_verification ev
    WHERE ev.token = verify_email.token
      AND ev.used_at IS NULL
      AND ev.expires_at > now();

  IF verification.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Mark token as used
  UPDATE roiheimen_private.email_verification
    SET used_at = now()
    WHERE id = verification.id;

  -- Mark email as verified
  UPDATE roiheimen_private.user_credentials
    SET email_verified = TRUE
    WHERE user_id = verification.user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION roiheimen.verify_email(TEXT) IS 'Verifies a user email using the verification token';

-- authenticate_user: Login with email/password, returns JWT
-- Includes brute force protection: locks after 3 failures in 5 minutes
CREATE OR REPLACE FUNCTION roiheimen.authenticate_user(
  email TEXT,
  password TEXT
) RETURNS roiheimen.user_jwt_token AS $$
DECLARE
  user_record roiheimen.user_account;
  credentials roiheimen_private.user_credentials;
  lockout_duration INTERVAL := interval '5 minutes';
  max_attempts INTEGER := 3;
BEGIN
  -- Find user by email (case-insensitive)
  SELECT * INTO user_record
    FROM roiheimen.user_account ua
    WHERE lower(ua.email) = lower(trim(authenticate_user.email));

  IF user_record.id IS NULL THEN
    -- User not found - return null but don't reveal this
    RETURN NULL;
  END IF;

  -- Get credentials
  SELECT * INTO credentials
    FROM roiheimen_private.user_credentials uc
    WHERE uc.user_id = user_record.id;

  -- Check for lockout (3 failures within 5 minutes)
  IF credentials.failed_attempts >= max_attempts
     AND credentials.first_failed_at > (now() - lockout_duration) THEN
    RAISE EXCEPTION 'Account temporarily locked. Try again later.';
  END IF;

  -- Reset failed attempts if lockout period has passed
  IF credentials.first_failed_at IS NOT NULL
     AND credentials.first_failed_at <= (now() - lockout_duration) THEN
    UPDATE roiheimen_private.user_credentials
      SET failed_attempts = 0, first_failed_at = NULL
      WHERE user_id = user_record.id;
    -- Refresh credentials
    SELECT * INTO credentials
      FROM roiheimen_private.user_credentials uc
      WHERE uc.user_id = user_record.id;
  END IF;

  -- Check password
  IF credentials.password_hash = crypt(password, credentials.password_hash) THEN
    -- Check if email is verified
    IF NOT credentials.email_verified THEN
      RAISE EXCEPTION 'Email not verified. Please check your inbox.';
    END IF;

    -- Reset failed attempts on successful login
    UPDATE roiheimen_private.user_credentials
      SET failed_attempts = 0, first_failed_at = NULL
      WHERE user_id = user_record.id;

    -- Log the session
    INSERT INTO roiheimen_private.user_session (user_id)
      VALUES (user_record.id);

    -- Return JWT token (6-day expiry)
    RETURN (
      'roiheimen_user',
      user_record.id,
      extract(epoch from (now() + interval '6 days'))
    )::roiheimen.user_jwt_token;
  ELSE
    -- Password incorrect - increment failed attempts
    UPDATE roiheimen_private.user_credentials
      SET
        failed_attempts = CASE
          WHEN first_failed_at IS NULL OR first_failed_at <= (now() - lockout_duration)
          THEN 1
          ELSE failed_attempts + 1
        END,
        first_failed_at = CASE
          WHEN first_failed_at IS NULL OR first_failed_at <= (now() - lockout_duration)
          THEN now()
          ELSE first_failed_at
        END
      WHERE user_id = user_record.id;

    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION roiheimen.authenticate_user(TEXT, TEXT) IS 'Authenticates a user with email/password and returns a JWT token';

-- request_password_reset: Generate password reset token
-- Returns the token that should be emailed to the user
CREATE OR REPLACE FUNCTION roiheimen.request_password_reset(
  email TEXT
) RETURNS TEXT AS $$
DECLARE
  user_record roiheimen.user_account;
  reset_token TEXT;
BEGIN
  -- Find user by email (case-insensitive)
  SELECT * INTO user_record
    FROM roiheimen.user_account ua
    WHERE lower(ua.email) = lower(trim(request_password_reset.email));

  IF user_record.id IS NULL THEN
    -- User not found - return null but don't reveal this
    -- (caller should show same message either way)
    RETURN NULL;
  END IF;

  -- Invalidate any existing unused reset tokens for this user
  UPDATE roiheimen_private.password_reset
    SET used_at = now()
    WHERE user_id = user_record.id
      AND used_at IS NULL;

  -- Generate new reset token (14-char hex)
  reset_token := encode(gen_random_bytes(7), 'hex');

  -- Create password reset record (1 hour expiry)
  INSERT INTO roiheimen_private.password_reset (user_id, token)
    VALUES (user_record.id, reset_token);

  RETURN reset_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION roiheimen.request_password_reset(TEXT) IS 'Generates a password reset token for the given email';

-- reset_password: Set new password using reset token
CREATE OR REPLACE FUNCTION roiheimen.reset_password(
  token TEXT,
  new_password TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  reset_record roiheimen_private.password_reset;
BEGIN
  -- Validate password strength
  IF char_length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long';
  END IF;

  -- Find valid, unused token
  SELECT * INTO reset_record
    FROM roiheimen_private.password_reset pr
    WHERE pr.token = reset_password.token
      AND pr.used_at IS NULL
      AND pr.expires_at > now();

  IF reset_record.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Mark token as used
  UPDATE roiheimen_private.password_reset
    SET used_at = now()
    WHERE id = reset_record.id;

  -- Update password and verify email (password reset confirms email ownership)
  UPDATE roiheimen_private.user_credentials
    SET password_hash = crypt(new_password, gen_salt('bf')),
        email_verified = TRUE,
        failed_attempts = 0,
        first_failed_at = NULL
    WHERE user_id = reset_record.user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION roiheimen.reset_password(TEXT, TEXT) IS 'Resets a user password using the reset token';

-- current_user_account: Get the currently authenticated user
CREATE OR REPLACE FUNCTION roiheimen.current_user_account() RETURNS roiheimen.user_account AS $$
  SELECT *
  FROM roiheimen.user_account
  WHERE id = nullif(current_setting('jwt.claims.user_id', true), '')::integer
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION roiheimen.current_user_account() IS 'Gets the user who was identified by our JWT';

-- user_logout: End user session
CREATE OR REPLACE FUNCTION roiheimen.user_logout() RETURNS BOOLEAN AS $$
DECLARE
  current_user_id INTEGER;
BEGIN
  current_user_id := nullif(current_setting('jwt.claims.user_id', true), '')::integer;

  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Mark latest session as logged out
  UPDATE roiheimen_private.user_session
    SET logout_at = now()
    WHERE user_id = current_user_id
      AND logout_at IS NULL;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION roiheimen.user_logout() IS 'Logs out the current user session';

-- ============================================================================
-- Roles and Permissions
-- ============================================================================

-- Create new role for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roiheimen_user') THEN
    CREATE ROLE roiheimen_user;
  END IF;
END
$$;

GRANT roiheimen_user TO roiheimen_postgraphile;
GRANT USAGE ON SCHEMA roiheimen TO roiheimen_user;

-- Table permissions
GRANT SELECT ON TABLE roiheimen.user_account TO roiheimen_user;
GRANT UPDATE ON TABLE roiheimen.user_account TO roiheimen_user;

-- Function permissions (anonymous can register/login/reset password)
GRANT EXECUTE ON FUNCTION roiheimen.register_user(TEXT, TEXT, TEXT) TO roiheimen_anonymous;
GRANT EXECUTE ON FUNCTION roiheimen.verify_email(TEXT) TO roiheimen_anonymous;
GRANT EXECUTE ON FUNCTION roiheimen.authenticate_user(TEXT, TEXT) TO roiheimen_anonymous;
GRANT EXECUTE ON FUNCTION roiheimen.request_password_reset(TEXT) TO roiheimen_anonymous;
GRANT EXECUTE ON FUNCTION roiheimen.reset_password(TEXT, TEXT) TO roiheimen_anonymous;

-- Authenticated user functions
GRANT EXECUTE ON FUNCTION roiheimen.current_user_account() TO roiheimen_user;
GRANT EXECUTE ON FUNCTION roiheimen.user_logout() TO roiheimen_user;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE roiheimen.user_account ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own account
CREATE POLICY select_own_user_account ON roiheimen.user_account
  FOR SELECT TO roiheimen_user
  USING (id = nullif(current_setting('jwt.claims.user_id', true), '')::integer);

CREATE POLICY update_own_user_account ON roiheimen.user_account
  FOR UPDATE TO roiheimen_user
  USING (id = nullif(current_setting('jwt.claims.user_id', true), '')::integer);

-- ============================================================================
-- Triggers
-- ============================================================================

-- updated_at trigger for user_account
CREATE TRIGGER user_account_updated_at
  BEFORE UPDATE ON roiheimen.user_account
  FOR EACH ROW
  EXECUTE PROCEDURE roiheimen_private.set_updated_at();
