# NexaHost Pterodactyl Bot

Discord bot for managing Pterodactyl users, servers, resources, and purchase tickets through Components V2.

## Requirements

- Ubuntu VPS
- Node.js 18 or newer
- Pterodactyl Application API key with Read + Write permissions
- Discord bot with Message Content Intent enabled

## Configuration

Create `/root/vps/.env`:

```env
DISCORD_TOKEN=your_discord_bot_token
PTERO_URL=https://panel.example.com
PTERO_API_KEY=your_application_api_key
PTERO_NODE_ID=1
PTERO_NEST_ID=5
PTERO_PYTHON_EGG_ID=16
PTERO_NODEJS_EGG_ID=15
ADMIN_ID=340219033486098433
```

Never commit `.env` to GitHub.

## Install

```bash
sudo apt update
sudo apt install -y git nodejs npm
cd /root
git clone https://github.com/hywsf8883-dev/ita.git vps
cd /root/vps
npm install
```

## Run Permanently

```bash
sudo cp nexahost-bot.service /etc/systemd/system/nexahost-bot.service
sudo systemctl daemon-reload
sudo systemctl enable --now nexahost-bot
sudo systemctl status nexahost-bot
```

View logs:

```bash
journalctl -u nexahost-bot -f
```

After a GitHub update:

```bash
cd /root/vps
git pull
npm install
sudo systemctl restart nexahost-bot
```

## Admin Commands

```text
.cra @user email@example.com Username
.cr @user
.dl @user
.adl @user
.sl
.setup instapay PAYMENT_DETAILS PRICE
.sr ROLE_ID
.tb
```

Only `ADMIN_ID` can use administration commands. Payment tickets are visible only to the buyer and the configured support role.
