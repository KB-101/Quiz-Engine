class QuizValidator {
    validate(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Invalid data format'] };
        }

        if (!data.metadata) errors.push('Missing "metadata"');
        if (!Array.isArray(data.questions)) errors.push('"questions" must be an array');

        if (errors.length) return { valid: false, errors };

        const m = data.metadata;
        if (!m.title || typeof m.title !== 'string') errors.push('metadata.title required');
        if (!m.subject || typeof m.subject !== 'string') errors.push('metadata.subject required');
        if (typeof m.questionCount !== 'number') errors.push('metadata.questionCount must be number');

        const seenIds = new Set();
        data.questions.forEach((q, i) => {
            const pre = `Q${i+1}`;
            if (!q.id) errors.push(`${pre} missing id`);
            else if (seenIds.has(q.id)) errors.push(`${pre} duplicate id "${q.id}"`);
            else seenIds.add(q.id);

            if (!q.question || !q.question.trim()) errors.push(`${pre} empty question`);

            // FLEXIBLE: Allow 2-6 options instead of exactly 4
            if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
                errors.push(`${pre} must have 2-6 options`);
            } else {
                q.options.forEach((opt, j) => {
                    if (!opt || !opt.trim()) errors.push(`${pre} option ${j+1} empty`);
                });
            }

            // Validate answer is within options range
            if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) {
                errors.push(`${pre} answer must be valid option index (0-${q.options.length - 1})`);
            }
            if (!q.explanation || !q.explanation.trim()) errors.push(`${pre} missing explanation`);
        });

        if (m.questionCount !== data.questions.length) {
            errors.push(`questionCount (${m.questionCount}) != actual (${data.questions.length})`);
        }

        return { valid: errors.length === 0, errors };
    }

    // Quick validation for preview (without full error details)
    quickValidate(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.metadata || !Array.isArray(data.questions)) return false;
        if (!data.metadata.title || data.questions.length === 0) return false;
        return true;
    }
}
