const { NodeSDK } = require('@opentelemetry/sdk-node');

const {
    getNodeAutoInstrumentations
} = require('@opentelemetry/auto-instrumentations-node');

const { trace } = require('@opentelemetry/api');

const sdk = new NodeSDK({
    instrumentations: [
        getNodeAutoInstrumentations()
    ]
});

sdk.start();

const tracer = trace.getTracer('search-engine');

const metrics = {
    totalExecutions: 0,

    algorithms: {
        naive: {
            executions: 0,
            totalTime: 0
        },

        rabin: {
            executions: 0,
            totalTime: 0
        }
    }
};

function updateMetrics(
    algorithm,
    executionTime
) {

    metrics.totalExecutions++;

    if (!metrics.algorithms[algorithm]) {

        metrics.algorithms[algorithm] = {
            executions: 0,
            totalTime: 0
        };
    }

    metrics.algorithms[algorithm]
        .executions++;

    metrics.algorithms[algorithm]
        .totalTime += Number(executionTime);
}

function getMetrics() {
    return metrics;
}

module.exports = {
    tracer,
    updateMetrics,
    getMetrics
};