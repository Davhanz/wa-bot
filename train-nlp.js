// train-nlp.js
const { NlpManager } = require("node-nlp");

(async () => {
    const manager = new NlpManager({ languages: ["id"], forceNER: true });

    // INTENT: Sapaan (halo)
    manager.addDocument("id", "halo", "sapaan.halo");
    manager.addDocument("id", "hai", "sapaan.halo");
    manager.addDocument("id", "hello", "sapaan.halo");
    manager.addDocument("id", "assalamualaikum", "sapaan.halo");
    manager.addDocument("id", "selamat pagi", "sapaan.halo");
    manager.addDocument("id", "selamat siang", "sapaan.halo");

    // INTENT: Terima kasih
    manager.addDocument("id", "terima kasih", "ucapan.terimakasih");
    manager.addDocument("id", "makasih ya", "ucapan.terimakasih");
    manager.addDocument("id", "thank you", "ucapan.terimakasih");
    manager.addDocument("id", "thanks", "ucapan.terimakasih");

    // INTENT: Help
    manager.addDocument("id", "bantuan", "menu.help");
    manager.addDocument("id", "help", "menu.help");
    manager.addDocument("id", "menu", "menu.help");
    manager.addDocument("id", "apa saja fiturnya", "menu.help");
    manager.addDocument("id", "tolong bantu", "menu.help");

    // INTENT: Jadwal posyandu
    manager.addDocument("id", "jadwal", "menu.jadwal");
    manager.addDocument("id", "jadwal posyandu", "menu.jadwal");
    manager.addDocument("id", "kapan jadwalnya", "menu.jadwal");
    manager.addDocument("id", "kapan posyandu", "menu.jadwal");
    manager.addDocument("id", "kapan posyandu berikutnya", "menu.jadwal");

    // INTENT: Daftar anak
    manager.addDocument("id", "anak", "menu.anak");
    manager.addDocument("id", "daftar anak", "menu.anak");
    manager.addDocument("id", "lihat anak", "menu.anak");
    manager.addDocument("id", "list anak", "menu.anak");

    // Jawaban default (bisa diabaikan, fallback)
    manager.addAnswer("id", "None", "Maaf saya belum paham maksudnya.");

    // Intent ucapan terima kasih
    const thanks = [
        "ok",
        "oke",
        "baik",
        "sip",
        "mantap",
        "terima kasih",
        "makasih",
        "makasi",
        "makasii",
        "trimakasih",
        "trims",
        "suwun",
        "hatur nuhun",
        "matur nuwun",
        "nuhun",
        "thx",
        "tq",
        "tx",
        "ty",
        "tysm",
        "makacih",
        "makacie",
        "makachii",
        "mksh",
        "thanks",
        "thank you",
        "thank u",
        "thankyou",
        "tanks",
        "thankx",
        "cheers",
        "siap",
        "noted",
        "okey",
        "yes",
        "ya",
        "yoi",
        "gas",
    ];
    thanks.forEach((t) => manager.addDocument("id", t, "ucapan.terimakasih"));

    console.log("⏳ Training NLP...");
    await manager.train();
    manager.save();
    console.log("✅ Training selesai dan model disimpan!");
})();
