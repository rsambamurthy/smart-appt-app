# WhatsApp — setup and templates

The code is done. Getting Meta to let you send is the long part: business
verification takes 1–3 working days, and each template is reviewed separately.
Start this before you need it.

## The model

**One sender, Integrata's.** The number is verified once against Integrata's
own business documents, and every association sends through it. No housing
society will complete Meta business verification with a GST certificate and a
template review queue, so the alternative is that nobody gets WhatsApp.

Consequences worth being deliberate about:

- Every template **names the association in its body**. A resident must be able
  to tell who is asking them for money.
- One association's misuse can get the shared number rate-limited or paused
  **for everyone**. `WHATSAPP_DAILY_CAP` (default 2000/association/day) is the
  circuit breaker, and `whatsapp_messages` is how you see volume before Meta
  does.
- Consent is per resident, not per association. `users.whatsapp_opt_in` must be
  true or nothing is sent, and the database refuses an opt-in with no date.

## 1. Meta setup

1. **Meta Business Manager** → create or use Integrata's business account.
2. **Business verification** → Settings → Business Info → Start Verification.
   Submit the certificate of incorporation or GST certificate, the website, and
   a phone number you can receive an OTP on. Usually 1–3 working days in India.
3. **WhatsApp Business Platform** → add a phone number.
   The number **must not be active on WhatsApp or WhatsApp Business** on any
   phone. If it is, delete that account first and wait — otherwise registration
   fails with an unhelpful error.
4. **System user token** → Business Settings → Users → System Users → create one
   with `whatsapp_business_messaging` and `whatsapp_business_management`.
   Generate a **permanent** token; the default one expires in 24 hours and the
   failure looks like "everything stopped working overnight".

## 2. Environment variables

On Railway (Gold service):

```
WHATSAPP_TOKEN=<permanent system user token>
WHATSAPP_PHONE_NUMBER_ID=<from WhatsApp Manager, not the phone number itself>
WHATSAPP_VERIFY_TOKEN=<any random string you invent; used only for the webhook handshake>
WHATSAPP_DAILY_CAP=2000
```

Never paste these into chat, a commit, or a support ticket. A leaked token lets
anyone message as you.

## 3. Webhook

In Meta → WhatsApp → Configuration → Webhook:

- **Callback URL:** `https://<your-api-host>/api/v1/dues/whatsapp/webhook`
- **Verify token:** the `WHATSAPP_VERIFY_TOKEN` above
- **Subscribe to:** `messages` (this carries delivery statuses)

The endpoint sits above `authenticate` in `dues.routes.ts` deliberately — Meta
cannot present a bearer token. It replies 200 immediately and processes after,
because Meta times out in seconds and disables endpoints that keep failing.

## 4. Templates to submit

Category matters for price: **utility** is ~₹0.115/message in India,
**authentication** ~₹0.135, **marketing** ₹0.78–0.99. Everything below is
utility or authentication. Do not let a reviewer reclassify one as marketing —
if that happens, rewrite to remove anything resembling promotion and resubmit.

Meta rejects templates for: promotional language in a utility template,
placeholders at the very start or end of the body, two placeholders adjacent
with nothing between them, and URLs in the body that are not buttons.

---

### `smartappt_due_notice` — Utility, English

**Header:** Document

**Body:**
```
{{1}} — maintenance due for flat {{2}}.

{{3}}
Amount due: Rs. {{4}}
Due date: {{5}}

The attached notice has a UPI QR code. Scan it with any UPI app to pay, then
enter the payment reference in SmartAppt so the treasurer can confirm it.
```

**Sample values** (Meta requires realistic ones, and rejects obvious dummies):
`Park Avenue Owners Association`, `A-101`, `Maintenance — August 2026`,
`2,975.00`, `05 Aug 2026`

---

### `smartappt_payment_confirmed` — Utility, English

**Body:**
```
{{1}} has confirmed your payment of Rs. {{2}} for {{3}}.

Reference {{4}}. Your account has been updated and no further action is needed.
```

**Sample:** `Park Avenue Owners Association`, `2,975.00`,
`Maintenance — August 2026`, `418523104567`

---

### `smartappt_payment_rejected` — Utility, English

**Body:**
```
{{1}} could not confirm your payment of Rs. {{2}} with reference {{3}}.

Reason: {{4}}

Please check the reference number and submit it again in SmartAppt, or contact
the treasurer.
```

**Sample:** `Park Avenue Owners Association`, `2,975.00`, `418523104567`,
`No matching credit found in the bank statement`

---

### `smartappt_login_otp` — Authentication, English

Build this with Meta's **authentication template** flow rather than a custom
body — it gets the one-tap copy button, better delivery, and the authentication
rate.

- Code delivery: **Copy code**
- Add security disclaimer: yes
- Expiry: 5 minutes (matches the OTP validity in `auth.service`)

The code is passed twice at send time: once in the body, once on the button.
That is required, not a mistake.

## 5. Turning it on

Set the environment variables and restart. Until `WHATSAPP_TOKEN` and
`WHATSAPP_PHONE_NUMBER_ID` are both present, `whatsappService.enabled` is false
and every path silently skips — no errors, no half-sent bill run.

OTP falls back to SMS automatically when WhatsApp fails or is not configured.
That fallback is deliberate and should not be removed: if WhatsApp delivery
breaks, nobody can log in at all.

## 6. Checking it works

```sql
-- Recent sends and how they went.
SELECT template, status, COUNT(*), MAX(created_at) AS latest
  FROM whatsapp_messages
 WHERE created_at > NOW() - INTERVAL '7 days'
 GROUP BY template, status
 ORDER BY template, status;

-- Failures worth acting on, newest first.
SELECT created_at, template, to_phone, error_code, error_message
  FROM whatsapp_messages
 WHERE status = 'FAILED'
 ORDER BY created_at DESC
 LIMIT 50;
```

`error_code` `131047` means the 24-hour window closed and a template was
required — it should not appear, since everything here is a template.
`132000`-range codes are template problems: paused, deleted, or parameter count
mismatched against what Meta approved.

## What is deliberately not built

**Inbound messages.** A resident replying to a notice goes nowhere. Handling
replies means a conversation state machine and a 24-hour-window cost model, and
is worth doing only alongside the gate-approval flow, where it earns its keep.

**Marketing or announcement broadcasts.** Cheap to add, expensive to send, and
the fastest route to residents blocking the shared number.
