const express = require("express");
const router = express.Router();
const { fetchFromApi } = require("../config/rapidApi");

router.get("/trims/:trimId", async (req, res) => {
  const { trimId } = req.params;

  if (!trimId || !/^\d+$/.test(trimId)) {
    return res.status(400).json({ error: "Invalid trim ID" });
  }

  try {
    const data = await fetchFromApi(`/cars/trims/${trimId}`);
    res.json(data);
  } catch (error) {
    console.error("❌ Car specs proxy error:", error.message);
    res.status(502).json({ error: "Failed to fetch car specs" });
  }
});

module.exports = router;
