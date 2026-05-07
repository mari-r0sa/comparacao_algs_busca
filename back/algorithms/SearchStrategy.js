    class SearchStrategy {
    validate(text, pattern) {
        if (!text || !pattern) {
            throw new Error("Texto e padrão são obrigatórios");
        }

        if (pattern.length > text.length) {
            throw new Error("Padrão maior que o texto");
        }
    }
}

module.exports = SearchStrategy;