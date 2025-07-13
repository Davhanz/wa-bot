const express = require("express");
const mysql = require("mysql2");
const auth = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi koneksi MariaDB
const db = mysql.createConnection({
    host: "localhost",
    user: "u186853304_davSunting",
    password: "Stunting_12!",
    database: "u186853304_stunting",
});

// Tes koneksi
db.connect((err) => {
    if (err) {
        console.error("Koneksi DB gagal:", err.message);
        return;
    }
    console.log("Terhubung ke MariaDB!");
});

// Endpoint aman dengan token
app.get("/alat", auth, (req, res) => {
    const id_user = req.user.id_user;

    db.query(
        "SELECT * FROM alat WHERE id_user = ?",
        [id_user],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
