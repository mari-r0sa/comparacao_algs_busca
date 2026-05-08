/* ===========================================================================================
NAIVE SEARCH
- Tenta encaixar o 'pattern' em todas as posições do código e verifica se dá match ou não.
- Para cada i, compara caractere por caractere (j) e, se não der match, avança uma posição
============================================================================================== */
const winston = require('winston');
const SearchStrategy = require('./SearchStrategy');
const SearchResult = require('../models/SearchResult');
const logger = require('../observability/logger');
const { updateMetrics } = require('../observability/telemetry');

class NaiveSearch extends SearchStrategy {

    search(text, pattern, stepByStep = false) {

        this.validate(text, pattern);

        const matches = [];
        const steps = [];

        let comparisons = 0;

        const startTime = performance.now();

        for (let i = 0; i <= text.length - pattern.length; i++) {

            if (stepByStep) {
                steps.push(`[SHIFT] i = ${i}`);
            }

            let j = 0;

            while (j < pattern.length) {

                comparisons++;

                if (stepByStep) {
                    steps.push(
                        `Comparando text[${i + j}]='${text[i + j]}' com pattern[${j}]='${pattern[j]}'`
                    );
                }

                if (text[i + j] !== pattern[j]) {

                    if (stepByStep) {
                        steps.push('Mismatch');
                    }

                    break;
                }

                if (stepByStep) {
                    steps.push('Match');
                }

                j++;
            }

            if (j === pattern.length) {

                matches.push(i);

                if (stepByStep) {
                    steps.push(`Encontrado na posição ${i}`);
                }
            }
        }

        const executionTime = (performance.now() - startTime).toFixed(4);

        updateMetrics(
            'naive',
            executionTime
        );

        logger.info({
            algorithm: 'naive',
            executionTime,
            comparisons,
            matches: matches.length
        });

        return new SearchResult({
            algorithm: 'Naive Search',
            matches,
            comparisons,
            executionTime,
            textLength: text.length,
            patternLength: pattern.length,
            complexity: 'O(n * m)',
            steps
        });
    }
}

module.exports = NaiveSearch;