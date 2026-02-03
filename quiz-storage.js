class QuizStorage {
    constructor() {
        this.STORAGE_KEY = 'quiz-engine-data-v2';
        this.RESULTS_KEY = 'quiz-engine-results-v2';
        this.RECENT_KEY = 'quiz-recent-v2';
        this.SCHEMA_VERSION = 2;
    }

    // ===== HASHING FOR DUPLICATE DETECTION =====

    generateContentHash(quizData) {
        // Create deterministic hash from quiz content
        const content = JSON.stringify({
            title: quizData.metadata?.title,
            subject: quizData.metadata?.subject,
            questions: (quizData.questions || []).map(q => ({
                question: q.question,
                options: q.options,
                answer: q.answer
            }))
        });

        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    checkDuplicate(quizData) {
        const hash = this.generateContentHash(quizData);
        const quizzes = this.getAll();

        for (const [id, quiz] of Object.entries(quizzes)) {
            if (quiz._contentHash === hash) {
                return { isDuplicate: true, existingId: id, existingTitle: quiz.metadata?.title };
            }
        }
        return { isDuplicate: false };
    }

    // ===== CORE STORAGE =====

    saveQuiz(quizData) {
        const duplicateCheck = this.checkDuplicate(quizData);
        if (duplicateCheck.isDuplicate) {
            return { 
                success: false, 
                duplicate: true, 
                existingId: duplicateCheck.existingId,
                existingTitle: duplicateCheck.existingTitle 
            };
        }

        const quizzes = this.getAll();
        const id = this.generateId(quizData);

        const quizCopy = JSON.parse(JSON.stringify(quizData));
        quizCopy._id = id;
        quizCopy._timestamp = Date.now();
        quizCopy._schemaVersion = this.SCHEMA_VERSION;
        quizCopy._contentHash = this.generateContentHash(quizData);

        quizzes[id] = quizCopy;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(quizzes));

        this.addToRecent(id);

        return { success: true, id };
    }

    forceSaveQuiz(quizData) {
        // Save even if duplicate (for updates)
        const quizzes = this.getAll();
        const id = this.generateId(quizData);

        const quizCopy = JSON.parse(JSON.stringify(quizData));
        quizCopy._id = id;
        quizCopy._timestamp = Date.now();
        quizCopy._schemaVersion = this.SCHEMA_VERSION;
        quizCopy._contentHash = this.generateContentHash(quizData);

        quizzes[id] = quizCopy;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(quizzes));

        this.addToRecent(id);

        return { success: true, id };
    }

    getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    getQuiz(id) {
        return this.getAll()[id];
    }

    // ===== AUTO-CLEANUP OF ORPHANED RESULTS =====

    deleteQuiz(id) {
        const quiz = this.getQuiz(id);
        if (!quiz) return false;

        // Remove quiz
        const quizzes = this.getAll();
        delete quizzes[id];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(quizzes));

        // Remove from recent
        const recent = this.getRecentIds().filter(rid => rid !== id);
        localStorage.setItem(this.RECENT_KEY, JSON.stringify(recent));

        // AUTO-CLEANUP: Remove orphaned results
        this.deleteResultsForQuiz(id);

        // Clean up session if this was current quiz
        const currentId = sessionStorage.getItem('current-quiz-id');
        if (currentId === id) {
            sessionStorage.removeItem('current-quiz-id');
            sessionStorage.removeItem('quiz-progress');
        }

        return true;
    }

    // ===== BULK OPERATIONS =====

    deleteMultipleQuiz(ids) {
        const results = { success: [], failed: [] };

        ids.forEach(id => {
            if (this.deleteQuiz(id)) {
                results.success.push(id);
            } else {
                results.failed.push(id);
            }
        });

        return results;
    }

    exportMultipleQuizzes(ids) {
        const quizzes = this.getAll();
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                count: ids.length,
                version: this.SCHEMA_VERSION
            },
            quizzes: {}
        };

        ids.forEach(id => {
            if (quizzes[id]) {
                // Strip internal fields for clean export
                const cleanQuiz = { ...quizzes[id] };
                delete cleanQuiz._id;
                delete cleanQuiz._timestamp;
                delete cleanQuiz._schemaVersion;
                delete cleanQuiz._contentHash;
                exportData.quizzes[id] = cleanQuiz;
            }
        });

        return exportData;
    }

    // ===== RESULTS MANAGEMENT =====

    getResultsKey(quizId) {
        return `${this.RESULTS_KEY}-${quizId}`;
    }

    saveResults(quizId, results) {
        const key = this.getResultsKey(quizId);
        const existing = JSON.parse(localStorage.getItem(key)) || [];
        existing.push({ 
            ...results, 
            date: Date.now(),
            _id: `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        localStorage.setItem(key, JSON.stringify(existing.slice(-20))); // Keep last 20 attempts
    }

    getResults(quizId) {
        const key = this.getResultsKey(quizId);
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch {
            return [];
        }
    }

    deleteResultsForQuiz(quizId) {
        const key = this.getResultsKey(quizId);
        localStorage.removeItem(key);
    }

    getAllResults() {
        const results = {};
        const quizzes = this.getAll();

        Object.keys(quizzes).forEach(quizId => {
            const quizResults = this.getResults(quizId);
            if (quizResults.length > 0) {
                results[quizId] = quizResults;
            }
        });

        return results;
    }

    // ===== RECENT QUIZZES =====

    getRecentQuizzes() {
        const ids = this.getRecentIds();
        const quizzes = this.getAll();

        return ids
            .map(id => {
                const q = quizzes[id];
                if (!q) return null;
                return {
                    id,
                    title: q.metadata?.title || 'Untitled',
                    subject: q.metadata?.subject || 'General',
                    questionCount: q.metadata?.questionCount || 0,
                    timestamp: q._timestamp,
                    hash: q._contentHash
                };
            })
            .filter(q => q !== null);
    }

    getRecentIds() {
        try {
            return JSON.parse(localStorage.getItem(this.RECENT_KEY)) || [];
        } catch {
            return [];
        }
    }

    addToRecent(id) {
        const recent = this.getRecentIds().filter(rid => rid !== id);
        recent.unshift(id);
        localStorage.setItem(this.RECENT_KEY, JSON.stringify(recent.slice(0, 20)));
    }

    setCurrentQuiz(id) {
        sessionStorage.setItem('current-quiz-id', id);
    }

    getCurrentQuiz() {
        const id = sessionStorage.getItem('current-quiz-id');
        return id ? this.getQuiz(id) : null;
    }

    // ===== UTILITIES =====

    clearAllData() {
        // Get all result keys
        const quizzes = this.getAll();
        Object.keys(quizzes).forEach(id => {
            localStorage.removeItem(this.getResultsKey(id));
        });

        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.RECENT_KEY);
        sessionStorage.clear();
    }

    generateId(data) {
        const title = (data.metadata?.title || 'quiz').toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .substring(0, 20);
        return `${title}-${Date.now()}`;
    }

    exportAll() {
        const data = {
            quizzes: this.getAll(),
            results: this.getAllResults(),
            exportedAt: new Date().toISOString()
        };
        return data;
    }

    getStorageStats() {
        const quizzes = this.getAll();
        const totalQuizzes = Object.keys(quizzes).length;

        let estimatedBytes = 0;
        try {
            estimatedBytes = new Blob([JSON.stringify(quizzes)]).size;
            // Add results size
            Object.keys(quizzes).forEach(id => {
                const results = localStorage.getItem(this.getResultsKey(id));
                if (results) estimatedBytes += results.length;
            });
        } catch {
            estimatedBytes = 0;
        }

        return {
            totalQuizzes,
            estimatedMB: (estimatedBytes / 1024 / 1024).toFixed(2),
            estimatedBytes
        };
    }
}
