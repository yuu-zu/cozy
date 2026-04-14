# Password Reset Email Deliverability

This project now sends a verification email for password reset requests. The email should contain one primary action only: `Xác thực`.

## Required DNS configuration

Use a real sending domain such as `no-reply@yourdomain.com`. Do not use a free mailbox provider for production password reset mail.

Configure these records on the sending domain:

- `SPF`: authorize the SMTP or email provider that actually sends the mail
- `DKIM`: enable DKIM signing in the provider dashboard and publish the generated DNS records
- `DMARC`: start with a monitoring policy, then tighten after verifying delivery

Example DMARC record:

```txt
Host: _dmarc.yourdomain.com
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; adkim=s; aspf=s
```

## Sender identity

Recommended values:

- `from_name`: `COZY`
- `from_email`: `no-reply@yourdomain.com`
- `subject`: `Xác thực yêu cầu đổi mật khẩu`

Keep the sender consistent across all reset emails. Frequent sender changes increase spam risk.

## Email content guidelines

To reduce spam scoring:

- keep the email short
- include one primary button only
- avoid all caps
- avoid multiple links
- avoid spammy punctuation and symbols

Recommended body copy:

- Intro: `Nhấn nút bên dưới để xác thực yêu cầu đổi mật khẩu.`
- Button label: `Xác thực`

## Template variables expected by the backend

The password reset request endpoint sends these template variables:

- `from_name`
- `from_email`
- `to_name`
- `to_email`
- `subject`
- `intro_text`
- `body_text`
- `action_label`
- `button_label`
- `verify_label`
- `verify_url`
- `action_url`

Point both `verify_url` and `action_url` to the same verification route in the web app.
