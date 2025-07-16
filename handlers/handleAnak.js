const pool = require("../db");
const dayjs = require("dayjs");
const { getNomorAkhir, formatNomorIndonesia } = require("../utils/nomorHelper");
const { formatTanggalIndonesia } = require("../utils/formatTanggal");

// Delay antar pesan (agar tidak dianggap spam oleh WhatsApp)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = async function handleAnak(sock, from) {
    const website = process.env.WEBSITE;
    try {
        const rawNomor = from.split("@")[0];
        const nomorAkhir = getNomorAkhir(rawNomor);
        const nomorFormatted = formatNomorIndonesia(rawNomor);

        // Cari user berdasarkan nomor
        const [userRows] = await pool.query(
            `SELECT id_user, nama_lengkap FROM user_details 
             WHERE REPLACE(REPLACE(REPLACE(nomor_hp, '+62', ''), '62', ''), '0', '') LIKE ? 
             LIMIT 1`,
            [`%${nomorAkhir}`]
        );

        if (userRows.length === 0) {
            return await sock.sendMessage(from, {
                text: `❌ Nomor *${nomorFormatted}* tidak terdaftar.`,
            });
        }

        const user = userRows[0];

        // Ambil data anak
        const [anakRows] = await pool.query(
            `SELECT nama_anak, jenis_kelamin, tanggal_lahir, berat_lahir, panjang_lahir 
             FROM anak 
             WHERE id_user = ?`,
            [user.id_user]
        );

        if (anakRows.length === 0) {
            return await sock.sendMessage(from, {
                text: `📭 Tidak ditemukan data anak untuk *${user.nama_lengkap}*.`,
            });
        }

        // Kirim pesan sambutan
        await sock.sendMessage(from, {
            text: `Hai *${user.nama_lengkap}*, berikut data anak Anda yang sudah terdaftar pada sistem kami:`,
        });

        await delay(300);

        // Kirim pesan untuk setiap anak
        for (const anak of anakRows) {
            const tanggalLahir = formatTanggalIndonesia(
                dayjs.unix(anak.tanggal_lahir)
            );
            const jenisKelamin =
                anak.jenis_kelamin === "L"
                    ? "Laki-laki"
                    : anak.jenis_kelamin === "P"
                    ? "Perempuan"
                    : "-";

            const pesanAnak = `*👶${anak.nama_anak}*\n🧬 ${jenisKelamin}\n📆 Tgl Lhr: ${tanggalLahir}\n⚖️ BB Lahir: ${anak.berat_lahir} kg\n📏 PB Lahir: ${anak.panjang_lahir} cm`;

            await sock.sendMessage(from, { text: pesanAnak });
            await delay(300); // jeda antar anak
        }

        // Kirim ajakan ke website
        await delay(300);
        await sock.sendMessage(from, {
            text: `Ingin lihat riwayat pengukuran lengkap? Kunjungi halaman *Pantau Anak* di website kami:`,
        });
        await delay(300);
        await sock.sendMessage(from, {
            text: `${website}`,
        });
    } catch (err) {
        console.error("❌ Error handleAnak:", err.message);
        await sock.sendMessage(from, {
            text: "⚠️ Terjadi kesalahan saat mengambil data anak.",
        });
    }
};
