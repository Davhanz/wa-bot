const pool = require("../db");
const { formatNomorIndonesia, getNomorAkhir } = require("../utils/nomorHelper");
const { formatTanggalIndonesia } = require("../utils/formatTanggal");

module.exports = async function handleInfo(sock, from) {
    const nomor = formatNomorIndonesia(from.split("@")[0]);
    const akhir = getNomorAkhir(nomor);
    const website = process.env.WEBSITE;

    try {
        const [rows] = await pool.query(
            `SELECT nama_lengkap, tanggal_lahir, alamat
            FROM user_details 
            WHERE REPLACE(REPLACE(REPLACE(nomor_hp, '+62', ''), '62', ''), '0', '') 
                LIKE ? 
            LIMIT 1`,
            [`%${akhir}`]
        );

        if (rows.length === 0) {
            await sock.sendMessage(from, {
                text: `❌ Nomor Anda belum terdaftar.\nSilakan daftar di: ${website}`,
            });
        } else {
            const user = rows[0];
            const pesan =
                `ℹ️ *Informasi Anda:*\n\n` +
                `👤 Nama: ${user.nama_lengkap}\n` +
                `🎂 Tgl Lhr: ${
                    user.tanggal_lahir
                        ? formatTanggalIndonesia(user.tanggal_lahir)
                        : "-"
                }\n` +
                `🏠 Alamat: ${user.alamat || "-"}`;
            await sock.sendMessage(from, { text: pesan });
        }
    } catch (err) {
        console.error("❌ DB Error:", err.message);
        await sock.sendMessage(from, {
            text: "⚠️ Terjadi kesalahan saat mengambil data Anda.",
        });
    }
};
