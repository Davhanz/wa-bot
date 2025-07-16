function formatNomorIndonesia(nomor) {
    nomor = nomor.replace(/\D/g, "");
    if (nomor.startsWith("0")) return "62" + nomor.slice(1);
    return nomor;
}

function getNomorAkhir(nomor) {
    return nomor.slice(2); // Buang "62"
}

module.exports = { formatNomorIndonesia, getNomorAkhir };
