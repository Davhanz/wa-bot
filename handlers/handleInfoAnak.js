const pool = require("../db");
const dayjs = require("dayjs");
const { getNomorAkhir, formatNomorIndonesia } = require("../utils/nomorHelper");
const { formatTanggalIndonesia } = require("../utils/formatTanggal");

module.exports = async function handleInfoAnak(sock, from, namaAnakInput) {
    const website = process.env.WEBSITE;
    try {
        const rawNomor = from.split("@")[0];
        const nomorAkhir = getNomorAkhir(rawNomor);
        const nomorFormatted = formatNomorIndonesia(rawNomor);
        const namaAnak = namaAnakInput.toLowerCase().trim();

        // Cek user
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

        // Cek anak
        const [anakRows] = await pool.query(
            `SELECT id_anak, nama_anak, jenis_kelamin, tanggal_lahir 
             FROM anak 
             WHERE id_user = ? AND LOWER(nama_anak) = ?`,
            [user.id_user, namaAnak]
        );

        if (anakRows.length === 0) {
            return await sock.sendMessage(from, {
                text: `❌ Anak *${namaAnakInput}* tidak ditemukan untuk *${user.nama_lengkap}*.`,
            });
        }

        const anak = anakRows[0];

        // Cek pengukuran terakhir
        const [ukurRows] = await pool.query(
            `SELECT create_at, berat, tinggi, lingkar_kepala, lingkar_lengan 
             FROM pengukuran 
             WHERE id_anak = ? 
             ORDER BY create_at DESC 
             LIMIT 1`,
            [anak.id_anak]
        );

        if (ukurRows.length === 0) {
            return await sock.sendMessage(from, {
                text: `📭 Belum ada data pengukuran untuk *${anak.nama_anak}*.`,
            });
        }

        const ukur = ukurRows[0];
        const tanggalUkur = formatTanggalIndonesia(dayjs.unix(ukur.create_at));
        const jenisKelamin =
            anak.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan";
        const tglLahir = formatTanggalIndonesia(dayjs.unix(anak.tanggal_lahir));

        const pesan = `❕Berikut hasil pengukuran terakhir\n
👶 *${anak.nama_anak}*
📆 Lahir: ${tglLahir}
🧬 ${jenisKelamin}

📊 *${tanggalUkur}*
⚖️ ${ukur.berat} kg
📏 ${ukur.tinggi} cm
🔵 Kepala: ${ukur.lingkar_kepala} cm
🟠 Lengan: ${ukur.lingkar_lengan} cm

Ingin lihat riwayat pengukuran lengkap? Kunjungi halaman *Pantau Anak* di website kami:\n${website}`;

        await sock.sendMessage(from, { text: pesan });
    } catch (err) {
        console.error("❌ Error handleInfoAnak:", err.message);
        await sock.sendMessage(from, {
            text: "⚠️ Terjadi kesalahan saat mengambil data anak.",
        });
    }
};
