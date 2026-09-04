require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const ADMIN = process.env.ADMIN_ID || '340219033486098433';
const PTERO = (process.env.PTERO_URL || '').replace(/\/$/, '');
const API_KEY = process.env.PTERO_API_KEY;
const NODE_ID = process.env.PTERO_NODE_ID || '1';
const NEST_ID = process.env.PTERO_NEST_ID || '5';
const EGGS = { nodejs: process.env.PTERO_NODEJS_EGG_ID || '15', python: process.env.PTERO_PYTHON_EGG_ID || '16' };
const DB_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ accounts: [], hosts: [] }, null, 2));
const read = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const write = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const ui = (message, extra = []) => { const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(message)); for (const row of extra) container.addActionRowComponents(row); return { flags: MessageFlags.IsComponentsV2, components: [container] }; };
const option = (label, value, description = '') => ({ label: label.slice(0, 100), value, description: description.slice(0, 100) });
const menu = (id, placeholder, options) => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(options));
const size = (v) => { const m = /^([\d.]+)\s*(mg|mb|g|gb)$/i.exec(v || ''); if (!m) return 0; return Math.round(Number(m[1]) * (/^g/i.test(m[2]) ? 1024 : 1)); };
const pretty = (mb) => mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
const panelLogin = `${PTERO}/auth/login`;
async function dm(discordId, message) { try { const user = await client.users.fetch(discordId); await user.send(ui(message)); } catch (error) { console.error(`DM failed for ${discordId}: ${error.message}`); } }
async function ptero(endpoint, options = {}) {
  const response = await fetch(`${PTERO}/api/application${endpoint}`, { ...options, headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'Application/vnd.pterodactyl.v1+json', 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.errors?.map(x => x.detail).join('\n') || `Pterodactyl API error ${response.status}`); return body;
}
async function allocation() { const list = await ptero(`/nodes/${NODE_ID}/allocations?per_page=100`); const free = list.data?.find(x => !x.attributes.assigned); if (!free) throw new Error('لا يوجد Port متاح في Node.'); return free.attributes.id; }
async function egg(id) { const result = await ptero(`/nests/${NEST_ID}/eggs/${id}?include=variables`); return result.attributes; }
async function createPanelUser(email, loginName) { const username = loginName.replace(/[^a-z0-9_]/gi, '').slice(0, 32) || `user${Date.now()}`; const body = { email, username, first_name: 'Nexa', last_name: 'User', password: username }; return (await ptero('/users', { method: 'POST', body: JSON.stringify(body) })).attributes; }
async function createServer(account, lang, ram, disk, cpu, name) {
  const e = await egg(EGGS[lang]); const allocationId = await allocation(); const env = {};
  for (const variable of e.relationships?.variables?.data || []) env[variable.attributes.env_variable] = variable.attributes.default_value || '';
  if (lang === 'nodejs') { env.PACKAGE_FILE = 'package.json'; env.STARTUP_FILE = 'index.js'; }
  const payload = { name, user: account.pteroId, nest: Number(NEST_ID), egg: Number(EGGS[lang]), docker_image: e.docker_image, startup: e.startup, environment: env, limits: { memory: ram, swap: 0, disk, io: 500, cpu }, feature_limits: { databases: 0, allocations: 1, backups: 1 }, deployment: { locations: [], dedicated_ip: false, port_range: [] }, start_on_completion: false, allocation: { default: allocationId, additional: [] } };
  return (await ptero('/servers', { method: 'POST', body: JSON.stringify(payload) })).attributes;
}
async function deleteServer(id) { await ptero(`/servers/${id}`, { method: 'DELETE' }); }
async function status(id) { try { const s = await ptero(`/servers/${id}`); return s.attributes?.status || 'offline'; } catch { return 'offline'; } }
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once('clientReady', () => console.log(`NexaHost Pterodactyl bot: ${client.user.tag}`));

client.on('messageCreate', async (m) => {
  if (m.author.bot || m.author.id !== ADMIN || !m.content.startsWith('.')) return;
  const [command, ...args] = m.content.trim().split(/\s+/); const db = read();
  try {
    if (command === '.cra') { const discordId = args.shift()?.match(/^<@!?([0-9]+)>$/)?.[1]; const [email, loginName] = args; if (!discordId || !email || !loginName) return m.reply(ui('الاستخدام: `.cra @user email@example.com Username`')); if (db.accounts.some(x => x.email === email)) return m.reply(ui('الحساب موجود بالفعل.')); const user = await createPanelUser(email, loginName); db.accounts.push({ email, username: user.username, discordId, pteroId: user.id }); await dm(discordId, `## تم إنشاء حسابك\n**رابط الدخول:** ${panelLogin}\n**Username:** ${user.username}\n**البريد:** ${email}\n**كلمة المرور:** ${user.username}\n\nUsername وPassword متطابقان. غيّر كلمة المرور بعد أول دخول.`); write(db); return m.reply(ui(`تم إنشاء الحساب وربطه بـ <@${discordId}>\nتم إرسال بيانات الدخول في الخاص.`)); }
    if (command === '.cr') { const discordId = args[0]?.match(/^<@!?([0-9]+)>$/)?.[1]; const accounts = db.accounts.filter(a => a.discordId === discordId); if (!discordId || !accounts.length) return m.reply(ui('استخدم `.cr @user` بعد إنشاء حسابه بـ `.cra @user email password`.')); return m.reply(ui('## إنشاء هوست\nاختر اللغة.', [menu('language:' + encodeURIComponent(accounts[0].email), 'اختر اللغة', [option('Node.js', 'nodejs', 'Egg 15'), option('Python', 'python', 'Egg 16')])])); }
    if (command === '.dl') { const discordId = args[0]?.match(/^<@!?([0-9]+)>$/)?.[1]; const hosts = db.hosts.filter(h => !discordId || h.discordId === discordId); if (!hosts.length) return m.reply(ui('لا توجد هوستات لهذا المستخدم.')); const all = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('delete-all:' + (discordId || 'all')).setLabel('حذف الكل').setStyle(ButtonStyle.Danger)); return m.reply(ui('## حذف هوست\nاختر الهوست أو اضغط حذف الكل.', [menu('delete', 'اختر الهوست', hosts.map(h => option(h.name, h.id, h.account))), all])); }
    if (command === '.adl') { const discordId = args[0]?.match(/^<@!?([0-9]+)>$/)?.[1]; const account = db.accounts.find(a => a.discordId === discordId); if (!account) return m.reply(ui('الحساب غير موجود.')); const owned = db.hosts.filter(h => h.account === account.email); for (const h of owned) await deleteServer(h.pteroId); await ptero(`/users/${account.pteroId}`, { method: 'DELETE' }); db.hosts = db.hosts.filter(h => h.account !== account.email); db.accounts = db.accounts.filter(a => a.email !== account.email); write(db); await dm(discordId, `## تم حذف حسابك\nتم حذف الحساب وجميع هوستاته (${owned.length}).`); return m.reply(ui(`تم حذف الحساب وكل هوستاته\n<@${discordId}>\nتم إرسال إشعار في الخاص.`)); }
    if (command === '.sl') { let online = 0; for (const h of db.hosts) if ((await status(h.pteroId)) === 'running') online++; return m.reply(ui(`## حالة Pterodactyl\n**الحسابات:** ${db.accounts.length}\n**الهوستات:** ${db.hosts.length}\n**تعمل:** ${online}\n**متوقفة:** ${db.hosts.length - online}`)); }
  } catch (e) { return m.reply(ui(`حدث خطأ:\n${e.message}`)); }
});

client.on('interactionCreate', async (i) => {
  if (i.user.id !== ADMIN) return i.reply({ ...ui('ليس لديك صلاحية.'), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  if (!i.isStringSelectMenu() && !i.isModalSubmit() && !i.isButton()) return; const db = read();
  if (i.isButton() && i.customId.startsWith('delete-all:')) { const key = i.customId.slice(12); const hosts = db.hosts.filter(h => key === 'all' || h.discordId === key); for (const h of hosts) { await deleteServer(h.pteroId); await dm(h.discordId, `## تم حذف الهوست\nتم حذف الهوست **${h.name}** من حسابك.`); } db.hosts = db.hosts.filter(h => !hosts.includes(h)); write(db); return i.update(ui(`تم حذف ${hosts.length} هوست وإرسال إشعار للمالكين.`)); }
  if (i.isStringSelectMenu() && i.customId === 'delete') { const h = db.hosts.find(x => x.id === i.values[0]); if (!h) return i.update(ui('## الهوست غير موجود')); await deleteServer(h.pteroId); db.hosts = db.hosts.filter(x => x.id !== h.id); write(db); await dm(h.discordId, `## تم حذف الهوست\nتم حذف الهوست **${h.name}** من حسابك.`); return i.update(ui('## تم حذف الهوست\nتم الحذف وإرسال إشعار في الخاص.')); }
  if (i.isStringSelectMenu() && i.customId === 'account') return i.update(ui('اختر اللغة.', [menu('language:' + encodeURIComponent(i.values[0]), 'اختر اللغة', [option('Node.js', 'nodejs', 'Egg 15'), option('Python', 'python', 'Egg 16')])]));
  if (i.isStringSelectMenu() && i.customId.startsWith('language:')) { const modal = new ModalBuilder().setCustomId(`settings:${i.customId.slice(9)}:${i.values[0]}`).setTitle('إعدادات الهوست').addLabelComponents(new LabelBuilder().setLabel('RAM مثل 1g أو 512mg').setTextInputComponent(new TextInputBuilder().setCustomId('ram').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('1g'))).addLabelComponents(new LabelBuilder().setLabel('التخزين مثل 5g أو 500mg').setTextInputComponent(new TextInputBuilder().setCustomId('disk').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('5g'))).addLabelComponents(new LabelBuilder().setLabel('المعالج من 20% إلى 600%').setTextInputComponent(new TextInputBuilder().setCustomId('cpu').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('100%'))).addLabelComponents(new LabelBuilder().setLabel('اسم الهوست').setTextInputComponent(new TextInputBuilder().setCustomId('name').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('my-node-app'))); return i.showModal(modal); }
  if (i.isModalSubmit() && i.customId.startsWith('settings:')) { const [, account, lang] = i.customId.split(':'); const ram = size(i.fields.getTextInputValue('ram')); const disk = size(i.fields.getTextInputValue('disk')); const cpu = Number((i.fields.getTextInputValue('cpu') || '').replace('%', '').trim()); const name = i.fields.getTextInputValue('name'); if (!ram || !disk || !Number.isInteger(cpu) || cpu < 20 || cpu > 600) return i.reply({ ...ui('تأكد من الموارد:\nRAM مثل `1g`\nالتخزين مثل `5g`\nالمعالج رقم من `20%` إلى `600%`.'), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }); await i.deferReply(); try { const a = db.accounts.find(x => x.email === decodeURIComponent(account)); const s = await createServer(a, lang, ram, disk, cpu, name); const host = { id: s.id.toString(), pteroId: s.id, identifier: s.identifier, name, account: a.email, discordId: a.discordId, language: lang, ram, disk, cpu }; db.hosts.push(host); write(db); await dm(a.discordId, `## هوست جديد جاهز\n**الاسم:** ${name}\n**اللغة:** ${lang === 'nodejs' ? 'Node.js' : 'Python'}\n**RAM:** ${pretty(ram)}\n**التخزين:** ${pretty(disk)}\n**المعالج:** ${cpu}%\n**رابط الهوست:** ${PTERO}/server/${s.identifier}\n\nتسجيل الدخول: ${panelLogin}`); return i.editReply(ui(`## تم إنشاء الهوست\nتم إنشاء الهوست وإرسال بياناته في الخاص إلى <@${a.discordId}>.`)); } catch (e) { return i.editReply(ui(`## فشل إنشاء الهوست\n${e.message}`)); } }
});
if (!process.env.DISCORD_TOKEN || !PTERO || !API_KEY) throw new Error('ضع DISCORD_TOKEN و PTERO_URL و PTERO_API_KEY في .env');
client.login(process.env.DISCORD_TOKEN);
