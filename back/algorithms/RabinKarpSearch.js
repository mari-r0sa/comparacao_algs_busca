const SearchStrategy = require('./SearchStrategy');
const SearchResult = require('../models/SearchResult');
const logger = require('../observability/logger');
const { updateMetrics } = require('../observability/telemetry');

class RabinKarpSearch extends SearchStrategy {
    search(text, pattern, stepByStep = false) {
        this.validate(text, pattern);
        
        const matches = [];
        const steps = [];

        let comparisons = 0;

        const d = 256;
        const q = 101;

        const m = pattern.length;
        const n = text.length;

        let p = 0;
        let t = 0;
        let h = 1;

        const startTime = performance.now();

        // h = pow(d, m-1) % q
        for (let i = 0; i < m - 1; i++) {
            h = (h * d) % q;
        }

        if (stepByStep) {
            steps.push(`h = ${h}`);
        }

        // hash inicial
        for (let i = 0; i < m; i++) {

            p =
                (d * p + pattern.charCodeAt(i)) % q;

            t =
                (d * t + text.charCodeAt(i)) % q;
        }

        if (stepByStep) {
            steps.push(`Hash pattern = ${p}`);
            steps.push(`Hash texto = ${t}`);
        }

        // sliding window
        for (let i = 0; i <= n - m; i++) {

            if (stepByStep) {
                steps.push(`[SHIFT] i = ${i}`);
            }

            // hash bateu
            if (p === t) {

                if (stepByStep) {
                    steps.push(
                        'Hash bateu, verificando caracteres'
                    );
                }

                let match = true;

                for (let j = 0; j < m; j++) {

                    comparisons++;

                    if (stepByStep) {
                        steps.push(
                            `Comparando text[${i + j}]='${text[i + j]}' com pattern[${j}]='${pattern[j]}'`
                        );
                    }

                    if (text[i + j] !== pattern[j]) {

                        match = false;

                        if (stepByStep) {
                            steps.push(
                                'Falso positivo (colisão)'
                            );
                        }

                        break;
                    }
                }

                if (match) {

                    matches.push(i);

                    if (stepByStep) {
                        steps.push(
                            `Encontrado na posição ${i}`
                        );
                    }
                }

            } else {

                if (stepByStep) {
                    steps.push('Hash diferente');
                }
            }

            // rolling hash
            if (i < n - m) {

                const oldHash = t;

                t =
                    (
                        d *
                        (t - text.charCodeAt(i) * h)
                        +
                        text.charCodeAt(i + m)
                    ) % q;

                if (t < 0) {
                    t += q;
                }

                if (stepByStep) {
                    steps.push(
                        `Rolling hash: ${oldHash} -> ${t}`
                    );
                }
            }

            if (stepByStep) {
                steps.push('----------------');
            }
        }

        const executionTime = Number(
            (performance.now() - startTime).toFixed(4)
        );

        updateMetrics(
            'rabin',
            executionTime
        );

        logger.info({
            algorithm: 'rabin-karp',
            executionTime,
            comparisons,
            matches: matches.length
        });

        return new SearchResult({
            algorithm: 'Rabin-Karp',
            matches,
            comparisons,
            executionTime,
            textLength: n,
            patternLength: m,
            complexity: 'O(n + m)',
            steps
        });
    }
}

module.exports = RabinKarpSearch;