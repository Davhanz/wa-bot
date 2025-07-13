const express = require("express");
const router = express.Router();
const alatController = require("../controllers/alatController");

router.get("/alat", alatController.getAlatByToken);

module.exports = router;
