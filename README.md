# Cozy Crypt Journal

## Email OTP registration

Dang ky hien da co buoc xac minh OTP qua email truoc khi tao tai khoan Firebase.

Tao file `.env` voi cac bien sau de gui OTP bang EmailJS:

```env
VITE_APP_NAME=COZY
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

Template EmailJS can nhan cac bien:

- `to_email`
- `to_name`
- `otp_code`
- `app_name`
- `expiry_minutes`
