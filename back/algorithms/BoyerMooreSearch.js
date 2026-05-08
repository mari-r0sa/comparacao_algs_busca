/* ===========================================================================================
BOYER-MOORE
- Usa a tabela bad character para dar saltos maiores no texto
============================================================================================== */
const SearchStrategy = require('./SearchStrategy');
const SearchResult = require('../models/SearchResult');
const logger = require('../observability/logger');
const { updateMetrics } = require('../observability/telemetry');

class BoyerMooreSearch extends SearchStrategy {

    buildBadCharTable(pattern) {
        const table = {};

        for (let i = 0; i < pattern.length; i++) {
            table[pattern[i]] = i;
        }

        return table;
    }

    search(text, pattern, stepByStep = false) {

        this.validate(text, pattern);

        const badChar = this.buildBadCharTable(pattern);

        const matches = [];
        const steps = [];

        let comparisons = 0;
        let shift = 0;

        const startTime = performance.now();

        if (stepByStep) {
            steps.push(`Tabela Bad Character: ${JSON.stringify(badChar)}`);
        }

        while (shift <= text.length - pattern.length) {

            if (stepByStep) {
                steps.push(`[SHIFT] ${shift}`);
            }

            let j = pattern.length - 1;

            while (j >= 0) {

                comparisons++;

                if (stepByStep) {
                    steps.push(`Comparando text[${shift + j}]='${text[shift + j]}' com pattern[${j}]='${pattern[j]}'`);
                }

                if (pattern[j] !== text[shift + j]) {

                    if (stepByStep) {
                        steps.push('Mismatch');
                    }

                    break;
                }

                if (stepByStep) {
                    steps.push('Match');
                }

                j--;
            }

            if (j < 0) {

                matches.push(shift);

                if (stepByStep) {
                    steps.push(`Encontrado na posição ${shift}`);
                }

                const nextShift =
                    (shift + pattern.length < text.length)
                        ? pattern.length -
                          (badChar[text[shift + pattern.length]] ?? -1)
                        : 1;

                if (stepByStep) {
                    steps.push(`Deslocamento após match: ${nextShift}`);
                }

                shift += nextShift;

            } else {

                const badCharIndex =
                    badChar[text[shift + j]] ?? -1;

                const shiftAmount =
                    Math.max(1, j - badCharIndex);

                if (stepByStep) {
                    steps.push(`BadChar='${text[shift + j]}' | índice=${badCharIndex} | shift=${shiftAmount}`);
                }

                shift += shiftAmount;
            }

            if (stepByStep) {
                steps.push('----------------');
            }
        }

        const executionTime =
            (performance.now() - startTime).toFixed(4);

        updateMetrics(
            'boyer-moore',
            Number(executionTime)
        );

        logger.info({
            algorithm: 'boyer-moore',
            executionTime,
            comparisons,
            matches: matches.length
        });

        return new SearchResult({
            algorithm: 'Boyer-Moore Search',
            matches,
            comparisons,
            executionTime,
            textLength: text.length,
            patternLength: pattern.length,
            complexity: 'O(n/m)',
            steps
        });
    }
}

module.exports = BoyerMooreSearch;