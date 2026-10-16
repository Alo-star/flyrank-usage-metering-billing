const express = require("express");

const router = express.Router();

// Record usage
router.post("/usage", (req, res) => {
    const { userId, tokens } = req.body;

    if (!userId || tokens == null) {
        return res.status(400).json({
            error: "userId and tokens are required"
        });
    }

    res.status(201).json({
        message: "Usage recorded successfully",
        data: {
            userId,
            tokens
        }
    });
});

module.exports = router;