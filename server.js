require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
require("dayjs/locale/id"); // Bahasa Indonesia
const { startSock, getSock } = require("./bot");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");
const { formatNomorIndonesia } = require("./utils/nomorHelper");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("id");

const app = express();
const PORT = process.env.PORT || 3000;

/* Middleware JSON */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* Middleware verifikasi token JWT */
const verifyTokenFromBody = (req, res, next) => {
    const token = req.body.token || req.query.token;

    if (!token) {
        return res.status(401).json({
            status: false,
            message: "Token diperlukan.",
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            status: false,
            message: "Token tidak valid.",
        });
    }
};

/** 📤 Kirim pesan WhatsApp manual */
app.post("/send-message", verifyTokenFromBody, async (req, res) => {
    const { number, message } = req.body;
    const id_user = req.user.id_user;

    if (!number || !message) {
        return res.status(400).json({
            status: false,
            message: "Number dan message wajib diisi.",
        });
    }

    try {
        const formattedNumber = formatNomorIndonesia(number);
        const sock = getSock();
        await sock.sendMessage(formattedNumber + "@s.whatsapp.net", {
            text: message,
        });
        res.json({
            status: true,
            message: "Pesan berhasil dikirim.",
            user_id: id_user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: "Gagal mengirim pesan.",
            error: err.message,
        });
    }
});

/** 📅 Notifikasi semua jadwal H-0 s.d H-2 dalam 1 pesan dengan count yang benar */
app.get("/cek-semua-jadwal", async (req, res) => {
    try {
        const now = dayjs().tz("Asia/Jakarta").startOf("day");
        const maxTime = now.add(2, "day").endOf("day").unix();

        // Ambil semua jadwal dalam 3 hari ke depan
        const [jadwalList] = await pool.query(
            `SELECT jadwal.id_jadwal, jadwal.waktu_mulai, jadwal.waktu_selesai,
                    lokasi.desa, lokasi.alamat, lokasi.latitude, lokasi.longitude 
             FROM jadwal 
             INNER JOIN lokasi ON lokasi.id_lokasi = jadwal.id_lokasi 
             WHERE waktu_mulai BETWEEN ? AND ? 
             ORDER BY waktu_mulai ASC`,
            [now.unix(), maxTime]
        );

        // Filter dan hitung selisih hari
        const jadwalValid = jadwalList
            .map((jadwal) => {
                const waktuMulai = dayjs
                    .unix(jadwal.waktu_mulai)
                    .tz("Asia/Jakarta");
                const selisihHari = waktuMulai.startOf("day").diff(now, "day");
                return { ...jadwal, selisihHari };
            })
            .filter((j) => j.selisihHari >= 0 && j.selisihHari <= 2);

        if (jadwalValid.length === 0) {
            return res.json({
                status: false,
                message: "Tidak ada jadwal dari hari ini hingga H+2.",
            });
        }

        // Ambil semua user
        const [userRows] = await pool.query(
            `SELECT nomor_hp, nama_lengkap FROM user_details`
        );
        const users = userRows.map((user) => ({
            ...user,
            nomor_hp: formatNomorIndonesia(user.nomor_hp),
        }));

        const sock = getSock();
        const todayEpoch = now.unix();
        const todayStr = now.format("YYYY-MM-DD");
        const hasil = [];

        // Cek status pengiriman untuk setiap jadwal
        const jadwalUntukDikirim = [];

        for (const jadwal of jadwalValid) {
            const [messageRows] = await pool.query(
                `SELECT * FROM message WHERE id_jadwal = ? LIMIT 1`,
                [jadwal.id_jadwal]
            );

            let countAwal;
            if (messageRows.length === 0) {
                // Hitung count awal berdasarkan H-
                countAwal = 2 - jadwal.selisihHari; // H-2:2, H-1:1, H-0:0
                await pool.query(
                    `INSERT INTO message (id_message, id_jadwal, keterangan, count, created_at) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        uuidv4(),
                        jadwal.id_jadwal,
                        "notifikasi",
                        countAwal,
                        todayEpoch,
                    ]
                );
                jadwalUntukDikirim.push({ ...jadwal, currentCount: countAwal });
            } else {
                const msg = messageRows[0];
                const lastSentDay = dayjs
                    .unix(msg.created_at)
                    .format("YYYY-MM-DD");

                // Jika belum dikirim hari ini
                if (lastSentDay !== todayStr) {
                    // Kurangi count
                    const newCount = msg.count - 1;
                    await pool.query(
                        `UPDATE message SET count = ?, created_at = ? 
                         WHERE id_jadwal = ?`,
                        [newCount, todayEpoch, jadwal.id_jadwal]
                    );

                    // Hanya kirim jika count >= 0
                    if (newCount >= 0) {
                        jadwalUntukDikirim.push({
                            ...jadwal,
                            currentCount: newCount,
                        });
                    }
                }
            }
        }

        if (jadwalUntukDikirim.length > 0) {
            // Susun pesan
            const headPesan = `Ada info jadwal Posyandu nih! `;
            let isiPesan = `Berikut jadwal layanan untuk minggu ini:\n\n`;

            // Kelompokkan per hari
            const jadwalPerHari = {};
            jadwalUntukDikirim.forEach((jadwal) => {
                const hariKey = dayjs
                    .unix(jadwal.waktu_mulai)
                    .tz("Asia/Jakarta")
                    .format("dddd, DD MMMM");
                if (!jadwalPerHari[hariKey]) jadwalPerHari[hariKey] = [];
                jadwalPerHari[hariKey].push(jadwal);
            });

            // Format pesan
            for (const [hari, jadwals] of Object.entries(jadwalPerHari)) {
                isiPesan += `\n📅 *${hari}:*\n`;
                jadwals.forEach((jadwal) => {
                    const waktuMulai = dayjs
                        .unix(jadwal.waktu_mulai)
                        .tz("Asia/Jakarta")
                        .format("HH:mm");

                    // Handle waktu_selesai (null atau tidak)
                    let waktuSelesaiText = "Selesai";
                    if (jadwal.waktu_selesai) {
                        waktuSelesaiText = dayjs
                            .unix(jadwal.waktu_selesai)
                            .tz("Asia/Jakarta")
                            .format("HH:mm");
                    }

                    isiPesan +=
                        `\n*${jadwal.desa}*\n` +
                        `⏰ ${waktuMulai} - ${waktuSelesaiText} WIB\n` +
                        `📍 ${jadwal.alamat}\n` +
                        `[🌏 Lihat Peta](https://maps.google.com/?q=${jadwal.latitude},${jadwal.longitude})\n`;
                });
                isiPesan += `\n\n`;
            }

            isiPesan += `Datang tepat waktu ya! 😊`;

            // Kirim ke semua user
            for (const user of users) {
                try {
                    await sock.sendMessage(user.nomor_hp + "@s.whatsapp.net", {
                        text: `Halo *${user.nama_lengkap}*, ${headPesan}${isiPesan}`,
                    });
                } catch (error) {
                    console.error(`Gagal ke ${user.nomor_hp}:`, error.message);
                }
            }

            hasil.push({
                status: true,
                total_jadwal: jadwalUntukDikirim.length,
                hari_tercakup: Object.keys(jadwalPerHari).length,
                detail: jadwalUntukDikirim.map((j) => ({
                    id_jadwal: j.id_jadwal,
                    H_min: j.selisihHari,
                    count: j.currentCount,
                    waktu: dayjs.unix(j.waktu_mulai).format("DD/MM HH:mm"),
                })),
            });
        }

        if (hasil.length === 0) {
            return res.json({
                status: false,
                message: "Tidak ada jadwal yang perlu dikirim hari ini.",
            });
        }

        res.json({
            status: true,
            message: "Notifikasi berhasil dikirim.",
            data: hasil,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: "Terjadi kesalahan",
            error: err.message,
        });
    }
});

/** 🔍 Data alat berdasarkan user */
app.get("/alat", verifyTokenFromBody, async (req, res) => {
    const id_user = req.user.id_user;

    try {
        const [rows] = await pool.query(
            "SELECT * FROM alat WHERE id_user = ?",
            [id_user]
        );
        res.json({ status: true, user_id: id_user, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: "Gagal mengambil data alat.",
            error: err.message,
        });
    }
});

/** 🛠 Endpoint untuk pengecekan uptime */
app.get("/ping", (req, res) => {
    res.status(200).send(
        "✅ Bot aktif - " +
            new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    );
});

/** 🚀 Jalankan server dan bot */
startSock().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    });
});
