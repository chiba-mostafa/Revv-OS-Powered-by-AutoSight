const express = require("express");
const router = express.Router();
const workflowController = require("../controllers/workflowController");

// Define the steps
router.post("/ingest", workflowController.stepIngestion);
router.post("/analyze", workflowController.stepAnalyst);
router.post("/direct", workflowController.stepDirector);
router.post("/script", workflowController.stepScriptwriter);
router.post("/visualize", workflowController.stepVisualizer);
router.post("/audio", workflowController.stepAudio);
router.post("/qa", workflowController.stepQA);

module.exports = router;
