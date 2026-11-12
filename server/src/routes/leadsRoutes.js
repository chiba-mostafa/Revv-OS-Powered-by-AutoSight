/**
 * Leads Routes
 *
 * POST /api/leads/book — Create a test drive booking
 */

const express = require("express");
const { bookTestDrive, getDealerByCarId } = require("../controllers/leadsController");

const router = express.Router();

router.post("/book", bookTestDrive);
router.get("/dealer", getDealerByCarId);

module.exports = router;
