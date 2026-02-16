-- PIN verifications for password reset (no shop required)
CREATE TABLE IF NOT EXISTS public.password_reset_pins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    pin VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_pins_email ON public.password_reset_pins(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_pins_expires ON public.password_reset_pins(expires_at);
