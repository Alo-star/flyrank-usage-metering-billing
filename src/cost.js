const pricing = require("./pricing");

function calculateTokenCost({
    inputTokens = 0,
    cachedInputTokens = 0,
    outputTokens = 0,
    reasoningTokens = 0
}) {
    const inputCost =
        (Number(inputTokens) / 1_000_000) *
        pricing.inputPerMillion;

    const cachedInputCost =
        (Number(cachedInputTokens) / 1_000_000) *
        
        pricing.cachedInputPerMillion;

    const outputCost =
        ((Number(outputTokens) + Number(reasoningTokens)) / 1_000_000) *
        pricing.outputPerMillion;

    return Number(
        (inputCost + cachedInputCost + outputCost).toFixed(6)
    );
}

module.exports = {
    calculateTokenCost
};