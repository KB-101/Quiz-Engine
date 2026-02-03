# Quiz Engine v2.0

[![Deploy to GitHub Pages](https://github.com/yourusername/quiz-engine/actions/workflows/deploy.yml/badge.svg)](https://github.com/yourusername/quiz-engine/actions/workflows/deploy.yml)

An enhanced offline-first quiz application with active recall, study modes, and bulk operations. Built for GitHub Pages deployment.

🚀 **[Live Demo](https://yourusername.github.io/quiz-engine/)**

## ✨ Features

- 📚 **Quiz Preview** - Review metadata before starting
- 🔀 **Shuffle Mode** - Randomize questions per session
- 📖 **Study Mode** - See explanations immediately
- ✅ **Bulk Operations** - Select, delete, or export multiple quizzes
- ↩️ **Undo Pattern** - 5-second undo for deletions
- 📱 **PWA Ready** - Works offline, installable
- 🌙 **Dark Mode** - Automatic theme detection
- ♿ **Accessible** - Full keyboard navigation & screen reader support

## 🚀 Quick Start (GitHub Pages)

### 1. Fork this repository

Click the "Fork" button at the top right of this page.

### 2. Enable GitHub Pages

1. Go to **Settings** → **Pages** in your forked repo
2. Under **Build and deployment**, select **GitHub Actions**
3. The site will deploy automatically

### 3. Access your site

Your app will be available at:
```
https://yourusername.github.io/quiz-engine/
```

### 4. Auto-deployment

Every push to `main` branch will automatically redeploy the site.

## 📖 Usage

### Importing Quizzes

1. Click "Browse Files" or drag-and-drop a JSON file
2. Review the preview modal
3. Toggle Shuffle/Study mode if desired
4. Click "Start Quiz"

### Creating Quizzes

Create a JSON file with this structure:

```json
{
  "metadata": {
    "title": "Quiz Title",
    "subject": "Category",
    "source": "Author",
    "questionCount": 5,
    "tags": ["tag1", "tag2"],
    "difficulty": "beginner",
    "estimatedTime": "5 minutes"
  },
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "Question text?",
      "options": ["A", "B", "C", "D"],
      "answer": 0,
      "explanation": "Why A is correct"
    }
  ]
}
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-6` | Select option |
| `←` `→` | Navigate questions |
| `Enter` | Confirm/Next |
| `Home` `End` | First/Last question |
| `Ctrl+T` | Toggle theme |
| `Esc` | Close modal |

## 🏗️ Architecture

```
quiz-engine/
├── .github/workflows/    # Auto-deployment
├── index.html           # Main app shell
├── style.css           # All styles
├── app.js              # Main application logic
├── quiz-storage.js     # Data layer with hashing
├── validator.js        # Quiz format validation
├── app.webmanifest     # PWA manifest
├── 404.html           # SPA routing fallback
├── sample-quiz.json   # Demo quiz
└── README.md          # This file
```

## 🔒 Data Storage

All data is stored **locally in your browser** using LocalStorage:
- **Quizzes**: Stored with content hashing for duplicate detection
- **Results**: Tracked per quiz with timestamps
- **Settings**: Theme preference

**Note**: Clearing browser data will delete your quizzes. Use the "Export All Data" button to backup regularly.

## 🌐 Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+
- iOS Safari 13+
- Chrome Android 80+

## 🛠️ Development

No build step required! This is a vanilla JavaScript application.

To run locally:

```bash
# Clone the repo
git clone https://github.com/yourusername/quiz-engine.git
cd quiz-engine

# Serve with any static server
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000`

## 📝 Customization

### Changing the Theme Color

Edit `--primary` in `style.css`:
```css
:root {
  --primary: #your-color;
  --primary-dark: #darker-shade;
}
```

### Adding Icons

1. Add PNG icons to `/icons/` folder
2. Update `app.webmanifest` with correct paths
3. Recommended sizes: 72, 96, 128, 144, 152, 192, 384, 512

### Enabling Service Worker (Optional)

For true offline support, create a `sw.js` file and register it in `app.js`:

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Made with ❤️ for learners everywhere**
