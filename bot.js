require("dotenv").config();
const baileys = require("@whiskeysockets/baileys");
const makeWASocket = baileys.default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
    baileys;
const P = require("pino");
const qrcode = require("qrcode-terminal");
const { NlpManager } = require("node-nlp");

// NLP Manager
const nlp = new NlpManager({ languages: ["id"] });
nlp.load();

// Handlers
const handleHalo = require("./handlers/handleHalo");
const handleHelp = require("./handlers/handleHelp");
const handleInfo = require("./handlers/handleInfo");
const handleInfoAnak = require("./handlers/handleInfoAnak");
const handleJadwal = require("./handlers/handleJadwal");
const handleAnak = require("./handlers/handleAnak");

const website = process.env.WEBSITE;
let sockGlobal = null;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("session");
    const sock = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: P({ level: "info" }),
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log("📌 Scan QR berikut untuk login:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut;
            if (shouldReconnect) startSock();
        } else if (connection === "open") {
            console.log("✅ Terhubung ke WhatsApp");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const content = msg.message[type];

        let text = "";

        if (type === "conversation") text = content;
        else if (type === "extendedTextMessage") text = content.text;
        else if (
            type === "imageMessage" ||
            type === "videoMessage" ||
            type === "documentMessage"
        ) {
            text = content.caption || "";
        }

        if (text) {
            const cmd = text.trim().toLowerCase();

            // === ✅ INFO & INFO ANAK HANDLE MANUAL ===
            if (cmd === "info") {
                return handleInfo(sock, from);
            }
            if (cmd.startsWith("info ")) {
                const nama = cmd.replace("info", "").trim();
                if (!nama) {
                    await sock.sendMessage(from, {
                        text: "❗ Format salah. Ketik *info [nama_anak]*.",
                    });
                    await delay(300);
                    return sock.sendMessage(from, {
                        text: "Contoh: *info David Pakpahan*",
                    });
                }
                return handleInfoAnak(sock, from, nama);
            }

            // === ✅ Cek NLP untuk yang lain ===
            const result = await nlp.process("id", cmd);

            if (result.intent !== "None" && result.score > 0.7) {
                switch (result.intent) {
                    case "sapaan.halo":
                        return handleHalo(sock, from);
                    case "menu.help":
                        return handleHelp(sock, from);
                    case "menu.jadwal":
                        return handleJadwal(sock, from);
                    case "menu.anak":
                        return handleAnak(sock, from);
                    case "ucapan.terimakasih":
                        return sock.sendMessage(from, {
                            text: "🙏 Sama-sama! Ketik *help* jika butuh bantuan lainnya.",
                        });
                }
            }

            // Fallback NLP
            await sock.sendMessage(from, {
                text: `❓ Maaf, saya belum paham maksud *${cmd}*. Ketik *help* atau kunjungi ${website}`,
            });
            return;
        } else {
            // Fallback pesan non-teks
            let reply = "";
            switch (type) {
                case "stickerMessage":
                    reply =
                        "👋 Terima kasih stikernya! Ketik *help* untuk melihat menu.";
                    break;
                case "audioMessage":
                    reply = "🎧 Maaf saya belum bisa memproses audio.";
                    break;
                case "locationMessage":
                    reply = "📍 Lokasi diterima. Terima kasih!";
                    break;
                case "contactMessage":
                    reply = "📇 Kontak diterima. Terima kasih!";
                    break;
                default:
                    reply = `⚠️ Saya belum bisa memproses jenis pesan ini. Ketik *help* untuk melihat menu.`;
            }
            await sock.sendMessage(from, { text: reply });
        }
    });

    sockGlobal = sock;
}

function getSock() {
    return sockGlobal;
}

module.exports = { startSock, getSock };
