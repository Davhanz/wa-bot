module.exports = async function handleHelp(sock, from) {
    const website = process.env.WEBSITE;
    await sock.sendMessage(from, {
        text: `📖 *Menu Bantuan*\n
📌 *info* — Info akun Anda  
📌 *info [nama_anak]* — Data anak  
📌 *jadwal* — Jadwal Posyandu  
📌 *anak* — Anak yang terdaftar

💬 *halo* — Menyapa bot  
❓ *help* — Tampilkan menu bantuan

🌐 Kunjungi website kami: ${website}`,
    });
};
