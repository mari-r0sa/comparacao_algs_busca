/* ===========================================================================================
KMP
- Usa a tabela LPS para evitar comparações repetidas
============================================================================================== */
const SearchStrategy = require('./SearchStrategy');
const SearchResult = require('../models/SearchResult');
const logger = require('../observability/logger');

class KmpSearch extends SearchStrategy {

    buildLPS(pattern) {

        const lps = new Array(pattern.length).fill(0);

        let length = 0;
        let i = 1;

        while (i < pattern.length) {

            if (pattern[i] === pattern[length]) {

                length++;
                lps[i] = length;
                i++;

            } else {

                if (length !== 0) {

                    length =
                        lps[length - 1];

                } else {

                    lps[i] = 0;
                    i++;
                }
            }
        }

        return lps;
    }

    search(text, pattern, stepByStep = false) {
        this.validate(text, pattern);

        const matches = [];
        const steps = [];

        let comparisons = 0;

        const startTime = performance.now();

        const lps = this.buildLPS(pattern);

        let i = 0;
        let j = 0;

        while (i < text.length) {

            comparisons++;

            if (stepByStep) {
                steps.push(
                    `Comparando text[${i}]='${text[i]}' com pattern[${j}]='${pattern[j]}'`
                );
            }

            if (text[i] === pattern[j]) {

                if (stepByStep) {
                    steps.push('Match');
                }

                i++;
                j++;
            }

            if (j === pattern.length) {

                matches.push(i - j);

                if (stepByStep) {
                    steps.push(`Encontrado na posição ${i - j}`);
                }

                j = lps[j - 1];

            } else if (
                i < text.length &&
                text[i] !== pattern[j]
            ) {

                if (stepByStep) {
                    steps.push('Mismatch');
                }

                if (j !== 0) {

                    const old = j;

                    j = lps[j - 1];

                    if (stepByStep) {
                        steps.push(`LPS: ${old} -> ${j}`);
                    }

                } else {
                    i++;
                }
            }

            if (stepByStep) {
                steps.push('----------------');
            }
        }

        const executionTime = (performance.now() - startTime).toFixed(4);

        logger.info({
            algorithm: 'kmp',
            executionTime,
            comparisons,
            matches: matches.length
        });

        return new SearchResult({
            algorithm: 'KMP Search',
            matches,
            comparisons,
            executionTime,
            textLength: text.length,
            patternLength: pattern.length,
            complexity: 'O(n + m)',
            steps
        });
    }
}

module.exports = KmpSearch;