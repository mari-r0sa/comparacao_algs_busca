const {
    metrics
} = require('@opentelemetry/api');

const meter =
    metrics.getMeter('search-meter');

const executionCounter =
    meter.createCounter(
        'algorithm_executions'
    );

const comparisonCounter =
    meter.createCounter(
        'algorithm_comparisons'
    );

module.exports = {
    executionCounter,
    comparisonCounter
};