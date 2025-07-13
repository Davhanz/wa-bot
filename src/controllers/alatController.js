const jwt = require("jsonwebtoken");
const db = require("../db");

exports.getAlatByToken = (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "Token dibutuhkan" });

    const token = auth.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const id_user = decoded.id_user;

        db.query(
            "SELECT * FROM alat WHERE id_user = ?",
            [id_user],
            (err, results) => {
                if (err)
                    return res.status(500).json({ error: "Kesalahan query" });
                res.json({ alat: results });
            }
        );
    } catch (err) {
        return res.status(403).json({ error: "Token tidak valid" });
    }
};
