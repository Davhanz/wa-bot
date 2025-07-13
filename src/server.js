const express = require("express");
const dotenv = require("dotenv");
const alatRoutes = require("./routes/alatRoutes");

dotenv.config();

const app = express();
app.use(express.json());
app.use("/", alatRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API berjalan di http://localhost:${PORT}`);
});
