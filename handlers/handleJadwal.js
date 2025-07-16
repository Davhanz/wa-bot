const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const pool = require("../db");
const { formatNomorIndonesia, getNomorAkhir } = require("../utils/nomorHelper");

dayjs.extend(utc);
dayjs.extend(timezone);

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = async function handleJadwal(sock, from) {
    try {
        const now = dayjs().tz("Asia/Jakarta").startOf("day");
        const maxTime = now.add(2, "day").endOf("day").unix();

        const rawNomor = from.split("@")[0];
        const nomorAkhir = getNomorAkhir(rawNomor);
        const [userRows] = await pool.query(
            `SELECT nama_lengkap FROM user_details 
             WHERE REPLACE(REPLACE(REPLACE(nomor_hp, '+62', ''), '62', ''), '0', '') LIKE ? 
             LIMIT 1`,
            [`%${nomorAkhir}`]
        );

        const namaUser = userRows.length > 0 ? userRows[0].nama_lengkap : null;

        const [jadwalList] = await pool.query(
            `SELECT jadwal.waktu_mulai, jadwal.waktu_selesai,
                    lokasi.desa, lokasi.alamat, lokasi.latitude, lokasi.longitude 
             FROM jadwal 
             INNER JOIN lokasi ON lokasi.id_lokasi = jadwal.id_lokasi 
             WHERE waktu_mulai BETWEEN ? AND ? 
             ORDER BY waktu_mulai ASC`,
            [now.unix(), maxTime]
        );

        const jadwalValid = jadwalList
            .map((jadwal) => {
                const waktuMulai = dayjs
                    .unix(jadwal.waktu_mulai)
                    .tz("Asia/Jakarta");
                const selisihHari = waktuMulai.startOf("day").diff(now, "day");
                return { ...jadwal, waktuMulai, selisihHari };
            })
            .filter((j) => j.selisihHari >= 0 && j.selisihHari <= 2);

        if (jadwalValid.length === 0) {
            return await sock.sendMessage(from, {
                text: "📭 Tidak ada jadwal Posyandu dari hari ini hingga H+2. 😊",
            });
        }

        // 🟢 1. Salam Pembuka
        const headPesan = namaUser
            ? `👋 Halo *${namaUser}*!`
            : `👋 Salam sehat!`;
        await sock.sendMessage(from, { text: headPesan });

        await delay(300);
        await sock.sendMessage(from, {
            text: `Berikut jadwal layanan Posyandu untuk pelayanan pengukuran anak minggu ini:\n`,
        });

        // 🔄 2. Kirim per hari
        const jadwalPerHari = {};
        jadwalValid.forEach((jadwal) => {
            const hariKey = jadwal.waktuMulai.format("dddd, DD MMMM");
            if (!jadwalPerHari[hariKey]) jadwalPerHari[hariKey] = [];
            jadwalPerHari[hariKey].push(jadwal);
        });

        for (const [hari, jadwals] of Object.entries(jadwalPerHari)) {
            let isi = `📅 *${hari}:*\n`;

            jadwals.forEach((jadwal) => {
                const waktuMulai = jadwal.waktuMulai.format("HH:mm");
                const waktuSelesai = jadwal.waktu_selesai
                    ? dayjs
                          .unix(jadwal.waktu_selesai)
                          .tz("Asia/Jakarta")
                          .format("HH:mm")
                    : "Selesai";

                isi +=
                    `\n*${jadwal.desa}*\n` +
                    `⏰ ${waktuMulai} - ${waktuSelesai} WIB\n` +
                    `📍 ${jadwal.alamat}\n` +
                    `[🌏 Lihat Peta](https://maps.google.com/?q=${jadwal.latitude},${jadwal.longitude})\n`;
            });

            await delay(300);
            await sock.sendMessage(from, { text: isi });
        }

        // 🟡 3. Penutup
        await delay(300);
        await sock.sendMessage(from, {
            text: `Silakan datang tepat waktu ya! Untuk info lengkap lainnya kunjungi website:`,
        });
        await delay(300);
        await sock.sendMessage(from, { text: `${process.env.WEBSITE}` });
    } catch (err) {
        console.error("❌ Error:", err.message);
        await sock.sendMessage(from, {
            text: "⚠️ Terjadi kesalahan saat mengambil data jadwal.",
        });
    }
};
