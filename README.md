# CatPS Host Bot

بوت Discord خاص بإدارة هوستات Docker. كل أوامر الإدارة محمية بالـ `ADMIN_ID`.

## التشغيل على Ubuntu

```bash
sudo apt update
sudo apt install -y docker.io nodejs npm
sudo systemctl enable --now docker
npm install
cp .env.example .env
nano .env
npm start
```

ضع Token البوت في `.env` فقط، ولا ترفعه إلى GitHub. يجب تفعيل `Message Content Intent` من Discord Developer Portal.

## الأوامر

```text
.cra email password
.cr
.dl
.adl email
.sl
```

الـ ID الموجود في `ADMIN_ID` هو الوحيد الذي يستطيع تنفيذ الأوامر.
