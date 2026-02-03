/**
 * QuizApp Web Edition v2.0
 * New Features: Quiz Preview, Bulk Operations, Undo Pattern, 
 * Shuffle Mode, Study Mode, PWA Integration, Duplicate Detection
 */

class QuizApp {
    constructor() {
        this.validator = new QuizValidator();
        this.storage = new QuizStorage();

        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.quizResults = null;
        this.sessionStartTime = null;

        // NEW: Shuffle mode
        this.shuffleEnabled = false;
        this.questionOrder = []; // Maps display index to original index

        // NEW: Study mode
        this.studyMode = false;
        this.questionAnswered = false; // Track if current question answered in study mode

        // NEW: Bulk selection
        this.bulkSelection = new Set();
        this.bulkMode = false;

        // NEW: Undo queue
        this.undoQueue = [];
        this.undoTimeouts = new Map();

        // NEW: PWA
        this.deferredInstallPrompt = null;
        this.isOnline = navigator.onLine;

        // Route definitions
        this.routes = {
            '#/welcome': 'welcome-screen',
            '#/quiz': 'quiz-screen',
            '#/results': 'results-screen'
        };

        this.init();
    }

    init() {
        // Remove loading screen
        window.addEventListener('load', () => {
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('app').style.display = 'block';
            }, 300);
        });

        this.initTheme();
        this.initPWA();
        this.bindElements();
        this.bindEvents();
        this.initRouter();
        this.loadRecentQuizzes();
        this.updateStorageStats();

        // Resume interrupted quiz if exists
        this.tryResumeQuiz();
    }

    // ===== PWA & OFFLINE =====

    initPWA() {
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredInstallPrompt = e;
            this.showInstallButton();
        });

        // Track online/offline status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateOfflineIndicator();
            this.showToast('Back online', 'success');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateOfflineIndicator();
            this.showToast('You are offline. Quiz engine still works!', 'warning');
        });

        // Initial check
        this.updateOfflineIndicator();
    }

    showInstallButton() {
        const installBtn = document.getElementById('install-btn');
        if (installBtn && this.deferredInstallPrompt) {
            installBtn.style.display = 'flex';
        }
    }

    async triggerInstall() {
        if (!this.deferredInstallPrompt) return;

        this.deferredInstallPrompt.prompt();
        const { outcome } = await this.deferredInstallPrompt.userChoice;

        if (outcome === 'accepted') {
            this.showToast('App installed successfully!', 'success');
            document.getElementById('install-btn').style.display = 'none';
        }

        this.deferredInstallPrompt = null;
    }

    updateOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.style.display = this.isOnline ? 'none' : 'flex';
        }
    }

    // ===== SECURITY =====

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ===== ROUTING =====

    initRouter() {
        window.addEventListener('hashchange', () => this.handleRoute());

        if (!window.location.hash) {
            window.location.hash = '#/welcome';
        } else {
            this.handleRoute();
        }
    }

    handleRoute() {
        const hash = window.location.hash;
        const screenId = this.routes[hash] || 'welcome-screen';

        if (hash === '#/quiz' && !this.currentQuiz) {
            window.location.hash = '#/welcome';
            return;
        }

        if (hash === '#/results' && !this.quizResults) {
            window.location.hash = '#/welcome';
            return;
        }

        this.showScreen(screenId);

        // Manage bulk mode visibility
        if (hash === '#/welcome') {
            this.updateBulkControls();
        }
    }

    navigateTo(route) {
        window.location.hash = route;
    }

    // ===== THEME =====

    initTheme() {
        const savedTheme = localStorage.getItem('quiz-app-theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('quiz-app-theme', newTheme);
        this.updateThemeIcon(newTheme);
        this.announceToScreenReader(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode enabled`);
    }

    updateThemeIcon(theme) {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.innerHTML = `<span aria-hidden="true">${theme === 'dark' ? '☀️' : '🌙'}</span>`;
            toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        }
    }

    // ===== EVENT BINDING =====

    bindElements() {
        // Theme & PWA
        this.themeToggle = document.getElementById('theme-toggle');
        this.installBtn = document.getElementById('install-btn');

        // File import
        this.dropZone = document.getElementById('drop-zone');
        this.fileInput = document.getElementById('file-input');
        this.browseBtn = document.getElementById('browse-btn');
        this.errorDisplay = document.getElementById('error-display');
        this.errorList = document.getElementById('error-list');

        // Bulk operations
        this.bulkToggleBtn = document.getElementById('bulk-toggle-btn');
        this.bulkActions = document.getElementById('bulk-actions');
        this.bulkSelectAll = document.getElementById('bulk-select-all');
        this.bulkDeselectAll = document.getElementById('bulk-deselect-all');
        this.bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        this.bulkExportBtn = document.getElementById('bulk-export-btn');
        this.bulkCount = document.getElementById('bulk-count');

        // Recent quizzes
        this.recentSection = document.getElementById('recent-quizzes');
        this.quizList = document.getElementById('quiz-list');
        this.clearAllBtn = document.getElementById('clear-all-btn');

        // Quiz Preview Modal
        this.previewModal = document.getElementById('preview-modal');
        this.previewTitle = document.getElementById('preview-title');
        this.previewSubject = document.getElementById('preview-subject');
        this.previewCount = document.getElementById('preview-count');
        this.previewSource = document.getElementById('preview-source');
        this.previewTags = document.getElementById('preview-tags');
        this.previewStartBtn = document.getElementById('preview-start-btn');
        this.previewCloseBtn = document.getElementById('preview-close-btn');
        this.previewShuffleToggle = document.getElementById('preview-shuffle-toggle');
        this.previewStudyToggle = document.getElementById('preview-study-toggle');

        // Quiz screen
        this.quizTitle = document.getElementById('quiz-title');
        this.quizSubject = document.getElementById('quiz-subject');
        this.currentQuestionEl = document.getElementById('current-question');
        this.totalQuestionsEl = document.getElementById('total-questions');
        this.progressFill = document.getElementById('progress-fill');
        this.progressContainer = document.getElementById('progress-container');
        this.questionText = document.getElementById('question-text');
        this.optionsContainer = document.getElementById('options-container');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.submitBtn = document.getElementById('submit-btn');
        this.selectedStatus = document.getElementById('selected-status');
        this.studyExplanation = document.getElementById('study-explanation');
        this.studyModeIndicator = document.getElementById('study-mode-indicator');
        this.shuffleIndicator = document.getElementById('shuffle-indicator');

        // Question navigator
        this.questionNavigator = document.getElementById('question-navigator');

        // Results screen
        this.scorePercent = document.getElementById('score-percent');
        this.quizMetadata = document.getElementById('quiz-metadata');
        this.correctCount = document.getElementById('correct-count');
        this.incorrectCount = document.getElementById('incorrect-count');
        this.percentage = document.getElementById('percentage');
        this.reviewQuestions = document.getElementById('review-questions');
        this.restartBtn = document.getElementById('restart-btn');
        this.exportBtn = document.getElementById('export-btn');

        // Storage
        this.exportAllBtn = document.getElementById('export-all-btn');
    }

    bindEvents() {
        // Theme & PWA
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        if (this.installBtn) {
            this.installBtn.addEventListener('click', () => this.triggerInstall());
        }

        // File import
        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                this.handleFileSelect({ target: { files: e.dataTransfer.files } });
            }
        });

        this.dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.fileInput.click();
            }
        });

        // Bulk operations
        if (this.bulkToggleBtn) {
            this.bulkToggleBtn.addEventListener('click', () => this.toggleBulkMode());
        }
        if (this.bulkSelectAll) {
            this.bulkSelectAll.addEventListener('click', () => this.selectAllBulk());
        }
        if (this.bulkDeselectAll) {
            this.bulkDeselectAll.addEventListener('click', () => this.deselectAllBulk());
        }
        if (this.bulkDeleteBtn) {
            this.bulkDeleteBtn.addEventListener('click', () => this.bulkDelete());
        }
        if (this.bulkExportBtn) {
            this.bulkExportBtn.addEventListener('click', () => this.bulkExport());
        }

        // Quiz Preview Modal
        if (this.previewCloseBtn) {
            this.previewCloseBtn.addEventListener('click', () => this.closePreview());
        }
        if (this.previewStartBtn) {
            this.previewStartBtn.addEventListener('click', () => this.startFromPreview());
        }
        // Close modal on backdrop click
        if (this.previewModal) {
            this.previewModal.addEventListener('click', (e) => {
                if (e.target === this.previewModal) this.closePreview();
            });
        }

        // Quiz navigation
        this.prevBtn.addEventListener('click', () => this.prevQuestion());
        this.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.submitBtn.addEventListener('click', () => this.submitQuiz());
        this.restartBtn.addEventListener('click', () => this.restartQuiz());
        this.exportBtn.addEventListener('click', () => this.exportResults());

        // Storage management
        if (this.clearAllBtn) {
            this.clearAllBtn.addEventListener('click', () => this.clearAllData());
        }
        if (this.exportAllBtn) {
            this.exportAllBtn.addEventListener('click', () => this.exportAllData());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Prevent accidental close during quiz
        window.addEventListener('beforeunload', (e) => {
            if (this.currentQuiz && this.userAnswers.some(a => a !== null)) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // ===== FILE IMPORT WITH PREVIEW =====

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.fileInput.value = '';

        try {
            const text = await file.text();
            const jsonData = JSON.parse(text);

            // Validate
            const validation = this.validator.validate(jsonData);

            if (!validation.valid) {
                this.showErrors(validation.errors);
                return;
            }

            // Check for duplicates
            const duplicateCheck = this.storage.checkDuplicate(jsonData);
            if (duplicateCheck.isDuplicate) {
                this.showToast(`"${this.escapeHtml(duplicateCheck.existingTitle)}" already exists in your library`, 'warning');
                // Still show preview but warn
            }

            // Store pending quiz and show preview instead of auto-loading
            this.pendingQuiz = jsonData;
            this.showPreview(jsonData, duplicateCheck.isDuplicate);

        } catch (error) {
            this.showErrors(['Invalid JSON file: ' + error.message]);
        }
    }

    // ===== QUIZ PREVIEW MODAL =====

    showPreview(quizData, isDuplicate) {
        this.previewTitle.textContent = quizData.metadata.title;
        this.previewSubject.textContent = quizData.metadata.subject || 'General';
        this.previewCount.textContent = `${quizData.questions.length} questions`;
        this.previewSource.textContent = quizData.metadata.source || 'Unknown source';

        // Show tags if available (new metadata field)
        if (quizData.metadata.tags && quizData.metadata.tags.length > 0) {
            this.previewTags.innerHTML = quizData.metadata.tags
                .map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`)
                .join('');
            this.previewTags.style.display = 'flex';
        } else {
            this.previewTags.style.display = 'none';
        }

        // Update button text if duplicate
        if (isDuplicate) {
            this.previewStartBtn.innerHTML = 'Replace Existing & Start';
            this.previewStartBtn.classList.add('warning');
        } else {
            this.previewStartBtn.innerHTML = 'Start Quiz';
            this.previewStartBtn.classList.remove('warning');
        }

        // Reset toggles
        this.previewShuffleToggle.checked = false;
        this.previewStudyToggle.checked = false;

        // Show modal
        this.previewModal.classList.add('active');
        this.previewModal.setAttribute('aria-hidden', 'false');

        // Trap focus
        this.previewStartBtn.focus();
    }

    closePreview() {
        this.previewModal.classList.remove('active');
        this.previewModal.setAttribute('aria-hidden', 'true');
        this.pendingQuiz = null;
    }

    startFromPreview() {
        if (!this.pendingQuiz) return;

        // Get settings from toggles
        this.shuffleEnabled = this.previewShuffleToggle.checked;
        this.studyMode = this.previewStudyToggle.checked;

        // Save quiz (force save if duplicate)
        const result = this.storage.forceSaveQuiz(this.pendingQuiz);

        if (result.success) {
            this.showToast(`Imported "${this.escapeHtml(this.pendingQuiz.metadata.title)}"`);
            this.hideErrors();

            // IMPORTANT: Close preview first, then refresh UI
            this.closePreview();

            // Force UI refresh before loading quiz
            this.loadRecentQuizzes();
            this.updateStorageStats();

            // Small delay to ensure UI updates before navigation
            setTimeout(() => {
                this.loadQuiz(result.id);
            }, 100);
        }
    }

    // ===== BULK OPERATIONS =====

    toggleBulkMode() {
        this.bulkMode = !this.bulkMode;
        this.bulkSelection.clear();

        if (this.bulkMode) {
            this.bulkToggleBtn.classList.add('active');
            this.bulkToggleBtn.textContent = 'Done';
            this.bulkActions.classList.add('active');
            this.quizList.classList.add('bulk-mode');
        } else {
            this.bulkToggleBtn.classList.remove('active');
            this.bulkToggleBtn.textContent = 'Select Multiple';
            this.bulkActions.classList.remove('active');
            this.quizList.classList.remove('bulk-mode');
        }

        this.updateBulkControls();
        this.loadRecentQuizzes(); // Re-render to show/hide checkboxes
    }

    toggleQuizSelection(quizId, event) {
        if (event) event.stopPropagation();

        if (this.bulkSelection.has(quizId)) {
            this.bulkSelection.delete(quizId);
        } else {
            this.bulkSelection.add(quizId);
        }

        this.updateBulkControls();

        // Update visual state
        const checkbox = document.querySelector(`[data-quiz-id="${quizId}"] .bulk-checkbox`);
        if (checkbox) {
            checkbox.checked = this.bulkSelection.has(quizId);
        }
    }

    selectAllBulk() {
        const quizzes = this.storage.getRecentQuizzes();
        quizzes.forEach(q => this.bulkSelection.add(q.id));
        this.updateBulkControls();
        this.loadRecentQuizzes();
    }

    deselectAllBulk() {
        this.bulkSelection.clear();
        this.updateBulkControls();
        this.loadRecentQuizzes();
    }

    updateBulkControls() {
        if (this.bulkCount) {
            this.bulkCount.textContent = `${this.bulkSelection.size} selected`;
        }
        if (this.bulkDeleteBtn) {
            this.bulkDeleteBtn.disabled = this.bulkSelection.size === 0;
        }
        if (this.bulkExportBtn) {
            this.bulkExportBtn.disabled = this.bulkSelection.size === 0;
        }
    }

    bulkDelete() {
        if (this.bulkSelection.size === 0) return;

        const ids = Array.from(this.bulkSelection);
        const count = ids.length;

        // Perform deletion with undo support
        this.performUndoableDelete(ids, count);

        // Exit bulk mode
        this.toggleBulkMode();
    }

    bulkExport() {
        if (this.bulkSelection.size === 0) return;

        const ids = Array.from(this.bulkSelection);
        const data = this.storage.exportMultipleQuizzes(ids);

        this.downloadJSON(data, `quiz-export-${ids.length}-quizzes-${Date.now()}.json`);
        this.showToast(`Exported ${ids.length} quizzes`);

        // Exit bulk mode
        this.toggleBulkMode();
    }

    // ===== UNDO PATTERN =====

    performUndoableDelete(ids, count) {
        // Store quiz data for potential restore
        const deletedQuizzes = {};
        ids.forEach(id => {
            const quiz = this.storage.getQuiz(id);
            if (quiz) {
                deletedQuizzes[id] = JSON.parse(JSON.stringify(quiz));
            }
        });

        // Perform deletion
        const results = this.storage.deleteMultipleQuiz(ids);

        // Update UI immediately
        this.loadRecentQuizzes();
        this.updateStorageStats();

        // Create undo toast
        this.showUndoToast(
            `Deleted ${results.success.length} quiz${results.success.length !== 1 ? 'zes' : ''}`,
            () => {
                // Restore action
                Object.entries(deletedQuizzes).forEach(([id, quizData]) => {
                    this.storage.forceSaveQuiz(quizData);
                });
                this.loadRecentQuizzes();
                this.updateStorageStats();
                this.showToast('Quizzes restored', 'success');
            }
        );
    }

    showUndoToast(message, undoCallback) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast-message toast-undo show';

        const undoId = 'undo-' + Date.now();

        toast.innerHTML = `
            <span>${message}</span>
            <button class="undo-btn" data-undo-id="${undoId}">Undo</button>
            <div class="undo-progress"></div>
        `;

        container.appendChild(toast);

        // Handle undo click
        const undoBtn = toast.querySelector('.undo-btn');
        undoBtn.addEventListener('click', () => {
            undoCallback();
            toast.remove();
            // Clear timeout
            if (this.undoTimeouts.has(undoId)) {
                clearTimeout(this.undoTimeouts.get(undoId));
                this.undoTimeouts.delete(undoId);
            }
        });

        // Auto-remove after 5 seconds
        const timeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
            this.undoTimeouts.delete(undoId);
        }, 5000);

        this.undoTimeouts.set(undoId, timeout);
    }

    // ===== QUIZ EXECUTION =====

    loadQuiz(quizId) {
        const quiz = this.storage.getQuiz(quizId);
        if (!quiz) {
            this.showToast('Quiz not found', 'error');
            return;
        }

        this.currentQuiz = quiz;
        this.currentQuestionIndex = 0;
        this.userAnswers = new Array(quiz.questions.length).fill(null);
        this.quizResults = null;
        this.sessionStartTime = Date.now();
        this.questionAnswered = false;

        // Setup shuffle if enabled
        if (this.shuffleEnabled) {
            this.questionOrder = this.generateShuffledOrder(quiz.questions.length);
        } else {
            this.questionOrder = quiz.questions.map((_, i) => i);
        }

        // Update UI
        this.quizTitle.textContent = quiz.metadata.title;
        this.quizSubject.textContent = quiz.metadata.subject;
        this.totalQuestionsEl.textContent = quiz.questions.length;

        // Show/hide mode indicators
        if (this.shuffleIndicator) {
            this.shuffleIndicator.style.display = this.shuffleEnabled ? 'flex' : 'none';
        }
        if (this.studyModeIndicator) {
            this.studyModeIndicator.style.display = this.studyMode ? 'flex' : 'none';
        }

        // Build question navigator
        this.buildQuestionNavigator();

        // Store in session
        this.storage.setCurrentQuiz(quizId);
        sessionStorage.setItem('quiz-progress', JSON.stringify({
            quizId,
            answers: this.userAnswers,
            index: 0,
            startTime: this.sessionStartTime,
            shuffleEnabled: this.shuffleEnabled,
            questionOrder: this.questionOrder,
            studyMode: this.studyMode
        }));

        this.navigateTo('#/quiz');
        this.loadQuestion();
    }

    generateShuffledOrder(length) {
        const order = Array.from({ length }, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        return order;
    }

    getOriginalQuestionIndex() {
        return this.questionOrder[this.currentQuestionIndex];
    }

    tryResumeQuiz() {
        const saved = sessionStorage.getItem('quiz-progress');
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                const quiz = this.storage.getQuiz(progress.quizId);
                if (quiz) {
                    // Offer to resume with custom modal instead of confirm()
                    this.showResumeModal(quiz, progress);
                }
            } catch (e) {
                sessionStorage.removeItem('quiz-progress');
            }
        }
    }

    showResumeModal(quiz, progress) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" role="dialog" aria-labelledby="resume-title" aria-modal="true">
                <h2 id="resume-title">Resume Quiz?</h2>
                <p>You were taking "${this.escapeHtml(quiz.metadata.title)}" and answered ${progress.answers.filter(a => a !== null).length} of ${quiz.questions.length} questions.</p>
                <div class="modal-actions">
                    <button class="btn-secondary" id="resume-dismiss">Start New</button>
                    <button class="btn-primary" id="resume-confirm">Resume</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#resume-dismiss').addEventListener('click', () => {
            sessionStorage.removeItem('quiz-progress');
            modal.remove();
        });

        modal.querySelector('#resume-confirm').addEventListener('click', () => {
            this.currentQuiz = quiz;
                    this.currentQuestionIndex = progress.index;
                    this.userAnswers = progress.answers;
                    this.sessionStartTime = progress.startTime;
                    this.shuffleEnabled = progress.shuffleEnabled || false;
                    this.questionOrder = progress.questionOrder || quiz.questions.map((_, i) => i);
                    this.studyMode = progress.studyMode || false;
                    this.storage.setCurrentQuiz(progress.quizId);
                    modal.remove();
                    this.navigateTo('#/quiz');
                    this.loadQuestion();
                });
            }

    loadQuestion() {
        if (!this.currentQuiz) return;

        const originalIndex = this.getOriginalQuestionIndex();
        const question = this.currentQuiz.questions[originalIndex];

        // Update progress
        const progress = ((this.currentQuestionIndex + 1) / this.currentQuiz.questions.length) * 100;
        this.currentQuestionEl.textContent = this.currentQuestionIndex + 1;
        this.progressFill.style.width = `${progress}%`;
        this.progressContainer.setAttribute('aria-valuenow', progress);

        // Update question text
        this.questionText.textContent = question.question;

        // Clear options
        this.optionsContainer.innerHTML = '';

        // Reset study mode state
        this.questionAnswered = false;
        if (this.studyExplanation) {
            this.studyExplanation.style.display = 'none';
            this.studyExplanation.innerHTML = '';
        }

        // Add options
        question.options.forEach((option, index) => {
            const optionBtn = document.createElement('button');
            optionBtn.className = 'option-btn';
            optionBtn.setAttribute('role', 'radio');
            optionBtn.setAttribute('aria-checked', 'false');

            const userAnswerIndex = this.userAnswers[originalIndex];
            if (userAnswerIndex === index) {
                optionBtn.classList.add('selected');
                optionBtn.setAttribute('aria-checked', 'true');
            }

            optionBtn.innerHTML = `
                <span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + index)}</span>
                <span class="option-text">${this.escapeHtml(option)}</span>
            `;

            optionBtn.addEventListener('click', () => this.selectOption(index));

            this.optionsContainer.appendChild(optionBtn);
        });

        // In study mode, if already answered, show explanation
        if (this.studyMode && this.userAnswers[originalIndex] !== null) {
            this.showStudyExplanation(originalIndex);
        }

        // Update navigation
        this.prevBtn.disabled = this.currentQuestionIndex === 0;

        if (this.currentQuestionIndex === this.currentQuiz.questions.length - 1) {
            this.nextBtn.style.display = 'none';
            this.submitBtn.style.display = 'block';
        } else {
            this.nextBtn.style.display = 'block';
            this.submitBtn.style.display = 'none';
        }

        // Update status
        const answer = this.userAnswers[originalIndex];
        this.selectedStatus.textContent = answer !== null ? 
            `Selected: ${String.fromCharCode(65 + answer)}` : 
            'Not answered';

        // Update navigator
        this.updateQuestionNavigator();

        // Save progress
        this.saveProgress();
    }

    buildQuestionNavigator() {
        if (!this.questionNavigator) return;

        this.questionNavigator.innerHTML = '';
        for (let i = 0; i < this.currentQuiz.questions.length; i++) {
            const btn = document.createElement('button');
            btn.className = 'nav-dot';
            btn.textContent = i + 1;
            btn.setAttribute('aria-label', `Go to question ${i + 1}`);
            btn.addEventListener('click', () => {
                this.currentQuestionIndex = i;
                this.loadQuestion();
            });
            this.questionNavigator.appendChild(btn);
        }
    }

    updateQuestionNavigator() {
        if (!this.questionNavigator) return;

        const dots = this.questionNavigator.querySelectorAll('.nav-dot');
        dots.forEach((dot, index) => {
            dot.classList.remove('current', 'answered');

            if (index === this.currentQuestionIndex) {
                dot.classList.add('current');
            }

            const originalIndex = this.questionOrder[index];
            if (this.userAnswers[originalIndex] !== null) {
                dot.classList.add('answered');
            }
        });
    }

    selectOption(optionIndex) {
        const originalIndex = this.getOriginalQuestionIndex();
        this.userAnswers[originalIndex] = optionIndex;
        this.questionAnswered = true;

        // Update UI
        const optionButtons = this.optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach((btn, index) => {
            const isSelected = index === optionIndex;
            btn.classList.toggle('selected', isSelected);
            btn.setAttribute('aria-checked', isSelected.toString());
        });

        this.selectedStatus.textContent = `Selected: ${String.fromCharCode(65 + optionIndex)}`;

        // In study mode, show explanation immediately
        if (this.studyMode) {
            this.showStudyExplanation(originalIndex);
        }

        this.saveProgress();
        this.updateQuestionNavigator();
    }

    showStudyExplanation(questionIndex) {
        if (!this.studyExplanation) return;

        const question = this.currentQuiz.questions[questionIndex];
        const userAnswer = this.userAnswers[questionIndex];
        const isCorrect = userAnswer === question.answer;

        this.studyExplanation.innerHTML = `
            <div class="study-result ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="study-result-icon">${isCorrect ? '✓' : '✗'}</div>
                <div class="study-result-text">
                    ${isCorrect ? 'Correct!' : `Incorrect. The answer was ${String.fromCharCode(65 + question.answer)}`}
                </div>
            </div>
            <div class="study-explanation-text">
                <strong>Explanation:</strong> ${this.escapeHtml(question.explanation)}
            </div>
        `;

        this.studyExplanation.style.display = 'block';
    }

    saveProgress() {
        if (!this.currentQuiz) return;
        sessionStorage.setItem('quiz-progress', JSON.stringify({
            quizId: this.currentQuiz._id,
            answers: this.userAnswers,
            index: this.currentQuestionIndex,
            startTime: this.sessionStartTime,
            shuffleEnabled: this.shuffleEnabled,
            questionOrder: this.questionOrder,
            studyMode: this.studyMode
        }));
    }

    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.loadQuestion();
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.loadQuestion();
        }
    }

    // ===== SUBMISSION & RESULTS =====

    submitQuiz() {
        if (!this.currentQuiz) return;

        // Map answers back to original order for scoring
        const answersInOriginalOrder = this.currentQuiz.questions.map((_, originalIndex) => {
            const displayIndex = this.questionOrder.indexOf(originalIndex);
            return this.userAnswers[displayIndex];
        });

        const unanswered = answersInOriginalOrder.findIndex(a => a === null);
        if (unanswered !== -1) {
            // Show custom modal instead of confirm()
            this.showSubmitConfirmation(unanswered);
            return;
        }

        this.finalizeSubmission(answersInOriginalOrder);
    }

    showSubmitConfirmation(unansweredIndex) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" role="dialog" aria-labelledby="submit-title" aria-modal="true">
                <h2 id="submit-title">Submit Quiz?</h2>
                <p>Question ${unansweredIndex + 1} is not answered. You can go back to answer it, or submit now.</p>
                <div class="modal-actions">
                    <button class="btn-secondary" id="submit-go-back">Go Back</button>
                    <button class="btn-primary" id="submit-anyway">Submit Anyway</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#submit-go-back').addEventListener('click', () => {
            this.currentQuestionIndex = this.questionOrder.indexOf(unansweredIndex);
            this.loadQuestion();
            modal.remove();
        });

        modal.querySelector('#submit-anyway').addEventListener('click', () => {
            const answersInOriginalOrder = this.currentQuiz.questions.map((_, originalIndex) => {
                const displayIndex = this.questionOrder.indexOf(originalIndex);
                return this.userAnswers[displayIndex];
            });
            this.finalizeSubmission(answersInOriginalOrder);
            modal.remove();
        });
    }

    finalizeSubmission(answersInOriginalOrder) {
        const results = this.calculateResults(answersInOriginalOrder);
        this.quizResults = results;

        // Save results
        const quizId = this.currentQuiz._id;
        if (quizId) {
            this.storage.saveResults(quizId, results);
        }

        // Clear progress
        sessionStorage.removeItem('quiz-progress');

        // Show results
        this.navigateTo('#/results');
        this.showResults(results);
    }

    calculateResults(answers) {
        const results = [];
        let correctCount = 0;
        const timeSpent = Date.now() - this.sessionStartTime;

        this.currentQuiz.questions.forEach((question, index) => {
            const userAnswer = answers[index];
            const isCorrect = userAnswer === question.answer;
            if (isCorrect) correctCount++;

            results.push({
                question: question.question,
                options: question.options,
                correctAnswer: question.answer,
                userAnswer: userAnswer,
                isCorrect: isCorrect,
                explanation: question.explanation
            });
        });

        const percentage = Math.round((correctCount / this.currentQuiz.questions.length) * 100);

        return {
            results: results,
            correct: correctCount,
            total: this.currentQuiz.questions.length,
            percentage: percentage,
            score: `${correctCount}/${this.currentQuiz.questions.length}`,
            timeSpent: timeSpent,
            shuffleEnabled: this.shuffleEnabled,
            studyMode: this.studyMode
        };
    }

    showResults(results) {
        // Update score circle
        let gradient = 'linear-gradient(135deg, #F44336, #C62828)';
        if (results.percentage >= 80) gradient = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
        else if (results.percentage >= 60) gradient = 'linear-gradient(135deg, #FF9800, #EF6C00)';

        document.getElementById('score-circle').style.background = gradient;
        this.scorePercent.textContent = `${results.percentage}%`;

        // Metadata with mode indicators
        let modeInfo = '';
        if (results.shuffleEnabled) modeInfo += ' • Shuffled';
        if (results.studyMode) modeInfo += ' • Study Mode';

        this.quizMetadata.textContent = 
            `${this.currentQuiz.metadata.title} • ${this.currentQuiz.metadata.subject} • ${results.total} questions${modeInfo}`;

        // Stats
        this.correctCount.textContent = results.correct;
        this.incorrectCount.textContent = results.total - results.correct;
        this.percentage.textContent = `${results.percentage}%`;

        // Review section
        this.reviewQuestions.innerHTML = '';
        results.results.forEach((result, index) => {
            const reviewItem = document.createElement('div');
            reviewItem.className = `review-item ${result.isCorrect ? 'correct' : 'incorrect'}`;

            const userAnswerText = result.userAnswer !== null ? 
                `${String.fromCharCode(65 + result.userAnswer)}. ${this.escapeHtml(result.options[result.userAnswer])}` : 
                'Not answered';

            reviewItem.innerHTML = `
                <div class="review-question">Q${index + 1}: ${this.escapeHtml(result.question)}</div>
                <div class="review-answer">
                    <span class="review-label">Your answer:</span>
                    <span>${this.escapeHtml(userAnswerText)}</span>
                </div>
                <div class="review-answer">
                    <span class="review-label">Correct answer:</span>
                    <span>${String.fromCharCode(65 + result.correctAnswer)}. ${this.escapeHtml(result.options[result.correctAnswer])}</span>
                </div>
                <div class="review-explanation">${this.escapeHtml(result.explanation)}</div>
            `;

            this.reviewQuestions.appendChild(reviewItem);
        });

        this.announceToScreenReader(`Quiz complete. Score: ${results.percentage} percent. ${results.correct} correct, ${results.total - results.correct} incorrect.`);
    }

    restartQuiz() {
        if (this.currentQuiz) {
            this.userAnswers = new Array(this.currentQuiz.questions.length).fill(null);
            this.currentQuestionIndex = 0;
            this.sessionStartTime = Date.now();
            this.questionAnswered = false;

            // Reshuffle if shuffle was enabled
            if (this.shuffleEnabled) {
                this.questionOrder = this.generateShuffledOrder(this.currentQuiz.questions.length);
            }

            this.saveProgress();
            this.buildQuestionNavigator();
            this.navigateTo('#/quiz');
            this.loadQuestion();
        }
    }

    // ===== DATA MANAGEMENT =====

    exportResults() {
        if (!this.quizResults) return;

        const exportData = {
            quiz: {
                title: this.currentQuiz.metadata.title,
                subject: this.currentQuiz.metadata.subject,
                source: this.currentQuiz.metadata.source
            },
            results: this.quizResults,
            exportedAt: new Date().toISOString()
        };

        this.downloadJSON(exportData, `results-${this.currentQuiz.metadata.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`);
        this.showToast('Results exported');
    }

    exportAllData() {
        const data = this.storage.exportAll();
        this.downloadJSON(data, `quiz-backup-${new Date().toISOString().split('T')[0]}.json`);
        this.showToast('All data exported');
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearAllData() {
        // Use custom modal instead of confirm()
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal danger" role="dialog" aria-labelledby="clear-title" aria-modal="true">
                <h2 id="clear-title">⚠️ Clear All Data?</h2>
                <p>This will permanently delete all quizzes and results. This action cannot be undone.</p>
                <div class="modal-actions">
                    <button class="btn-secondary" id="clear-cancel">Cancel</button>
                    <button class="btn-danger" id="clear-confirm">Delete Everything</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#clear-cancel').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#clear-confirm').addEventListener('click', () => {
            this.storage.clearAllData();
            this.currentQuiz = null;
            this.loadRecentQuizzes();
            this.updateStorageStats();
            this.showToast('All data cleared');
            this.navigateTo('#/welcome');
            modal.remove();
        });
    }

    // ===== UI COMPONENTS =====

    loadRecentQuizzes() {
        const recent = this.storage.getRecentQuizzes();

        if (recent.length === 0) {
            if (this.recentSection) this.recentSection.style.display = 'none';
            return;
        }

        // Force show section and ensure display is set
        if (this.recentSection) {
            this.recentSection.style.display = 'block';
            this.recentSection.classList.add('active');
        }
        this.quizList.innerHTML = '';

        if (this.clearAllBtn) {
            this.clearAllBtn.style.display = recent.length > 1 ? 'block' : 'none';
        }

        // Show/hide bulk toggle based on count
        if (this.bulkToggleBtn) {
            this.bulkToggleBtn.style.display = recent.length > 1 ? 'flex' : 'none';
        }

        recent.forEach(quiz => {
            const item = document.createElement('div');
            item.className = 'quiz-item';
            item.setAttribute('data-id', quiz.id);
            item.setAttribute('data-quiz-id', quiz.id);
            item.setAttribute('role', 'listitem');

            if (this.bulkMode) {
                item.classList.add('selectable');
            }

            const title = this.escapeHtml(quiz.title);
            const subject = this.escapeHtml(quiz.subject);
            const date = new Date(quiz.timestamp).toLocaleDateString();
            const isSelected = this.bulkSelection.has(quiz.id);

            let checkboxHtml = '';
            if (this.bulkMode) {
                checkboxHtml = `
                    <div class="bulk-checkbox-wrapper" onclick="event.stopPropagation()">
                        <input type="checkbox" class="bulk-checkbox" 
                               ${isSelected ? 'checked' : ''} 
                               aria-label="Select ${title}">
                    </div>
                `;
            }

            item.innerHTML = `
                ${checkboxHtml}
                <div class="quiz-item-content">
                    <div class="quiz-item-header">
                        <div class="quiz-item-title">${title}</div>
                        ${!this.bulkMode ? `<button class="quiz-delete-btn" aria-label="Delete ${title}" title="Delete">🗑️</button>` : ''}
                    </div>
                    <div class="quiz-item-meta">${subject}</div>
                    <div class="quiz-item-meta small">${quiz.questionCount} questions • ${date}</div>
                    ${!this.bulkMode ? `
                        <div class="quiz-item-actions">
                            <button class="btn-small load-btn" data-action="load">Start Quiz</button>
                            <button class="btn-small preview-btn" data-action="preview">Preview</button>
                        </div>
                    ` : ''}
                </div>
            `;

            // Event handling
            if (this.bulkMode) {
                const checkbox = item.querySelector('.bulk-checkbox');
                if (checkbox) {
                    checkbox.addEventListener('change', (e) => {
                        this.toggleQuizSelection(quiz.id, e);
                    });
                }
                item.addEventListener('click', (e) => {
                    if (e.target.type !== 'checkbox') {
                        const cb = item.querySelector('.bulk-checkbox');
                        cb.checked = !cb.checked;
                        this.toggleQuizSelection(quiz.id);
                    }
                });
            } else {
                item.addEventListener('click', (e) => {
                    const target = e.target;
                    if (target.matches('[data-action="load"]')) {
                        this.loadQuiz(quiz.id);
                    } else if (target.matches('[data-action="preview"]')) {
                        this.showQuizPreviewFromLibrary(quiz.id);
                    } else if (target.matches('.quiz-delete-btn')) {
                        this.deleteQuizWithUndo(quiz.id);
                    }
                });
            }

            this.quizList.appendChild(item);
        });
    }

    showQuizPreviewFromLibrary(quizId) {
        const quiz = this.storage.getQuiz(quizId);
        if (!quiz) return;

        this.pendingQuiz = quiz;
        this.showPreview(quiz, false);
    }

    deleteQuizWithUndo(quizId) {
        const quiz = this.storage.getQuiz(quizId);
        if (!quiz) return;

        const title = quiz.metadata.title;
        const quizData = JSON.parse(JSON.stringify(quiz));

        // Perform deletion
        this.storage.deleteQuiz(quizId);

        // If current quiz deleted, go home
        if (this.currentQuiz && this.currentQuiz._id === quizId) {
            this.currentQuiz = null;
            sessionStorage.removeItem('quiz-progress');
        }

        this.loadRecentQuizzes();
        this.updateStorageStats();

        // Show undo
        this.showUndoToast(
            `Deleted "${this.escapeHtml(title)}"`,
            () => {
                this.storage.forceSaveQuiz(quizData);
                this.loadRecentQuizzes();
                this.updateStorageStats();
                this.showToast('Quiz restored', 'success');
            }
        );
    }

    updateStorageStats() {
        const stats = this.storage.getStorageStats();
        const fill = document.getElementById('storage-fill');
        const text = document.getElementById('storage-text');
        const info = document.querySelector('.storage-info');

        if (info && stats) {
            info.style.display = 'block';
            info.classList.add('active');
            const percent = Math.min((stats.estimatedBytes / (5 * 1024 * 1024)) * 100, 100);
            fill.style.width = `${percent}%`;

            if (percent > 80) fill.style.background = 'var(--danger)';
            else if (percent > 50) fill.style.background = 'var(--warning)';
            else fill.style.background = 'var(--success)';

            text.textContent = `${stats.estimatedMB} MB / 5 MB • ${stats.totalQuizzes} quizzes`;
        }
    }

    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.setAttribute('aria-hidden', 'true');
        });

        const screen = document.getElementById(screenName);
        if (screen) {
            screen.classList.add('active');
            screen.setAttribute('aria-hidden', 'false');
            window.scrollTo(0, 0);
        }
    }

    showToast(message, type = 'info') {
        // Don't show regular toast if there's an undo toast with same message
        const container = document.getElementById('toast-container');
        const existing = container.querySelector('.toast-message:not(.toast-undo)');
        if (existing && existing.textContent === message) {
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    }

    announceToScreenReader(message) {
        const announcer = document.getElementById('notification-area');
        announcer.textContent = message;
    }

    // ===== KEYBOARD NAVIGATION =====

    handleKeyboard(event) {
        // Theme toggle
        if ((event.ctrlKey || event.metaKey) && event.key === 't') {
            event.preventDefault();
            this.toggleTheme();
            return;
        }

        // Close modal on Escape
        if (event.key === 'Escape') {
            const modal = document.querySelector('.modal-overlay.active');
            if (modal) {
                event.preventDefault();
                modal.remove();
                return;
            }
        }

        // Only handle quiz shortcuts when quiz is active
        if (!this.currentQuiz || !document.getElementById('quiz-screen').classList.contains('active')) {
            return;
        }

        // Get current question to check option count
        const originalIndex = this.getOriginalQuestionIndex();
        const question = this.currentQuiz.questions[originalIndex];
        const maxOptions = question.options.length;

        switch(event.key) {
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                const idx = parseInt(event.key) - 1;
                if (idx < maxOptions) {
                    this.selectOption(idx);
                }
                break;

            case 'ArrowLeft':
                event.preventDefault();
                this.prevQuestion();
                break;

            case 'ArrowRight':
            case 'Enter':
                event.preventDefault();
                if (this.studyMode && !this.questionAnswered) {
                    // In study mode, Enter reveals answer if not answered
                    if (this.userAnswers[originalIndex] !== null) {
                        this.nextQuestion();
                    }
                } else if (this.currentQuestionIndex === this.currentQuiz.questions.length - 1) {
                    this.submitQuiz();
                } else {
                    this.nextQuestion();
                }
                break;

            case 'Home':
                event.preventDefault();
                this.currentQuestionIndex = 0;
                this.loadQuestion();
                break;

            case 'End':
                event.preventDefault();
                this.currentQuestionIndex = this.currentQuiz.questions.length - 1;
                this.loadQuestion();
                break;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.quizApp = new QuizApp();
});
