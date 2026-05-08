const logger = require('./logger');

function logSteps(fileName, algorithm, steps) {

    logger.info(
        `========== ${fileName} ==========`
    );

    steps.forEach(step => {

        logger.info({
            file: fileName,
            algorithm,
            step
        });

    });

    logger.info(
        '===================================='
    );
}

module.exports = logSteps;