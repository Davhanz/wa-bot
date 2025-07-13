const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
    const token = req.headers["authorization"];

    if (!token)
        return res.status(401).json({ message: "Token tidak ditemukan" });

    try {
        const decoded = jwt.verify(token, "rahasia123");
        req.user = decoded; // misal { id_user: 1 }
        next();
    } catch (err) {
        return res.status(403).json({ message: "Token tidak valid" });
    }
};
