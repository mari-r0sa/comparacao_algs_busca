class SearchResult {
    constructor({
        algorithm,
        matches,
        comparisons,
        executionTime,
        textLength,
        patternLength,
        complexity,
        steps = []
    }) {
        this.algorithm = algorithm;
        this.matches = matches;
        this.occurrences = matches.length;

        this.metrics = {
            comparisons,
            executionTime,
            textLength,
            patternLength,
            complexity
        };

        this.steps = steps;
    }
}

module.exports = SearchResult;