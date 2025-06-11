// 高级功能模块 - 智能英语学习助手

// 测试系统
class QuizSystem {
    constructor() {
        this.currentQuiz = null;
        this.quizHistory = [];
        this.streakCount = 0;
    }

    generateQuiz(type = 'mixed') {
        if (wordsData.length < 4) return null;

        const questionTypes = type === 'mixed' 
            ? ['chinese-to-english', 'english-to-chinese', 'fill-blank', 'listening']
            : [type];
        
        const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
        const correctWord = wordsData[Math.floor(Math.random() * wordsData.length)];
        
        // 生成错误选项
        const wrongOptions = [];
        while (wrongOptions.length < 3) {
            const randomWord = wordsData[Math.floor(Math.random() * wordsData.length)];
            if (randomWord.id !== correctWord.id && !wrongOptions.find(w => w.id === randomWord.id)) {
                wrongOptions.push(randomWord);
            }
        }
        
        const options = [correctWord, ...wrongOptions].sort(() => Math.random() - 0.5);
        
        return {
            id: Date.now(),
            type: questionType,
            correctWord,
            options,
            correctIndex: options.findIndex(w => w.id === correctWord.id),
            startTime: Date.now()
        };
    }

    checkAnswer(selectedIndex, quiz) {
        const endTime = Date.now();
        const responseTime = endTime - quiz.startTime;
        const isCorrect = selectedIndex === quiz.correctIndex;
        
        const result = {
            correct: isCorrect,
            responseTime,
            word: quiz.correctWord,
            selectedOption: quiz.options[selectedIndex]
        };

        this.quizHistory.push(result);
        
        if (isCorrect) {
            this.streakCount++;
            userStats.totalPoints += Math.max(5, 20 - Math.floor(responseTime / 1000));
        } else {
            this.streakCount = 0;
        }

        // 更新单词掌握度
        const difficulty = isCorrect ? (responseTime < 3000 ? 'easy' : 'normal') : 'hard';
        spacedRepetition.calculateNextReview(quiz.correctWord.id, difficulty);

        return result;
    }

    getAccuracy() {
        if (this.quizHistory.length === 0) return 0;
        const correct = this.quizHistory.filter(q => q.correct).length;
        return Math.round((correct / this.quizHistory.length) * 100);
    }

    getAverageResponseTime() {
        if (this.quizHistory.length === 0) return 0;
        const total = this.quizHistory.reduce((sum, q) => sum + q.responseTime, 0);
        return Math.round(total / this.quizHistory.length / 1000);
    }
}

// 学习分析系统
class LearningAnalytics {
    constructor() {
        this.sessionStart = Date.now();
        this.dailyStats = JSON.parse(localStorage.getItem('dailyStats') || '{}');
    }

    recordStudySession(wordId, difficulty, timeSpent) {
        const today = new Date().toISOString().split('T')[0];
        
        if (!this.dailyStats[today]) {
            this.dailyStats[today] = {
                wordsStudied: new Set(),
                totalTime: 0,
                sessions: [],
                difficulties: { easy: 0, normal: 0, hard: 0 }
            };
        }

        this.dailyStats[today].wordsStudied.add(wordId);
        this.dailyStats[today].totalTime += timeSpent;
        this.dailyStats[today].difficulties[difficulty]++;
        
        localStorage.setItem('dailyStats', JSON.stringify(this.dailyStats, (key, value) => {
            if (value instanceof Set) {
                return Array.from(value);
            }
            return value;
        }));
    }

    getWeeklyProgress() {
        const weeklyData = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            
            const dayData = this.dailyStats[dateKey];
            weeklyData.push({
                date: dateKey,
                wordsStudied: dayData ? Array.from(dayData.wordsStudied || []).length : 0,
                timeSpent: dayData ? dayData.totalTime : 0
            });
        }
        
        return weeklyData;
    }

    getRecommendations() {
        const recommendations = [];
        
        // 基于学习历史的推荐
        if (this.getStudyStreak() < 3) {
            recommendations.push({
                type: 'consistency',
                message: '建议每天坚持学习，养成良好的学习习惯',
                action: 'study'
            });
        }

        // 基于单词掌握情况的推荐
        const difficultWords = Object.entries(userStats.wordProgress)
            .filter(([_, progress]) => progress.level === 0)
            .length;

        if (difficultWords > 5) {
            recommendations.push({
                type: 'review',
                message: `有 ${difficultWords} 个单词需要重点复习`,
                action: 'review'
            });
        }

        return recommendations;
    }

    getStudyStreak() {
        const dates = Object.keys(this.dailyStats).sort().reverse();
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        
        for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - i);
            const expectedDateStr = expectedDate.toISOString().split('T')[0];
            
            if (date === expectedDateStr && this.dailyStats[date].wordsStudied.length > 0) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }
}

// 游戏化系统
class GamificationSystem {
    constructor() {
        this.achievements = [
            { id: 'first_word', name: '初学者', description: '学习第一个单词', condition: () => userStats.studiedToday >= 1, unlocked: false },
            { id: 'streak_3', name: '坚持不懈', description: '连续学习3天', condition: () => analytics.getStudyStreak() >= 3, unlocked: false },
            { id: 'streak_7', name: '一周达人', description: '连续学习7天', condition: () => analytics.getStudyStreak() >= 7, unlocked: false },
            { id: 'points_100', name: '百分达人', description: '获得100积分', condition: () => userStats.totalPoints >= 100, unlocked: false },
            { id: 'points_500', name: '积分大师', description: '获得500积分', condition: () => userStats.totalPoints >= 500, unlocked: false },
            { id: 'quiz_perfect', name: '完美答题', description: '测试中答对10题', condition: () => quizSystem.streakCount >= 10, unlocked: false }
        ];
        
        this.loadAchievements();
    }

    checkAchievements() {
        let newAchievements = [];
        
        this.achievements.forEach(achievement => {
            if (!achievement.unlocked && achievement.condition()) {
                achievement.unlocked = true;
                newAchievements.push(achievement);
                this.showAchievementNotification(achievement);
            }
        });

        if (newAchievements.length > 0) {
            this.saveAchievements();
        }

        return newAchievements;
    }

    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ffd700, #ffed4e);
            color: #333;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(255, 215, 0, 0.3);
            z-index: 1000;
            animation: slideInRight 0.5s ease, fadeOut 0.5s ease 3s;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">🏆 成就解锁!</div>
            <div style="font-size: 14px; font-weight: 600;">${achievement.name}</div>
            <div style="font-size: 12px; opacity: 0.8;">${achievement.description}</div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);

        // 添加CSS动画
        if (!document.getElementById('achievement-styles')) {
            const style = document.createElement('style');
            style.id = 'achievement-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    saveAchievements() {
        localStorage.setItem('achievements', JSON.stringify(this.achievements));
    }

    loadAchievements() {
        const saved = localStorage.getItem('achievements');
        if (saved) {
            const savedAchievements = JSON.parse(saved);
            this.achievements.forEach(achievement => {
                const saved = savedAchievements.find(s => s.id === achievement.id);
                if (saved) {
                    achievement.unlocked = saved.unlocked;
                }
            });
        }
    }

    getUnlockedAchievements() {
        return this.achievements.filter(a => a.unlocked);
    }
}

// 初始化高级功能
const quizSystem = new QuizSystem();
const analytics = new LearningAnalytics();
const gamification = new GamificationSystem();

// 增强现有功能
const originalMarkWordDifficulty = markWordDifficulty;
markWordDifficulty = function(difficulty) {
    originalMarkWordDifficulty(difficulty);
    
    // 记录学习分析
    analytics.recordStudySession(wordsData[currentWordIndex].id, difficulty, 30);
    
    // 检查成就
    gamification.checkAchievements();
};

// 添加高级UI功能
function createAdvancedUI() {
    // 获取现有导航或创建新的
    let nav = document.querySelector('.nav');
    
    if (!nav) {
        nav = createNavigation();
    } else {
        // 如果导航已存在，确保卡片学习按钮有正确的事件绑定
        const existingFlashcardBtn = nav.querySelector('button');
        if (existingFlashcardBtn && existingFlashcardBtn.textContent.includes('卡片学习')) {
            existingFlashcardBtn.onclick = showFlashcardMode;
        }
    }
    
    // 检查是否已添加了高级功能按钮，避免重复添加
    if (!nav.querySelector('[data-feature="quiz"]')) {
        // 测试模式按钮
        const quizBtn = document.createElement('button');
        quizBtn.className = 'nav-btn';
        quizBtn.innerHTML = '🎯 智能测试';
        quizBtn.onclick = showQuizMode;
        quizBtn.setAttribute('data-feature', 'quiz');
        nav.appendChild(quizBtn);
        
        // 统计按钮
        const statsBtn = document.createElement('button');
        statsBtn.className = 'nav-btn';
        statsBtn.innerHTML = '📊 学习统计';
        statsBtn.onclick = showStatsMode;
        statsBtn.setAttribute('data-feature', 'stats');
        nav.appendChild(statsBtn);
        
        // 成就按钮
        const achievementsBtn = document.createElement('button');
        achievementsBtn.className = 'nav-btn';
        achievementsBtn.innerHTML = '🏆 成就系统';
        achievementsBtn.onclick = showAchievements;
        achievementsBtn.setAttribute('data-feature', 'achievements');
        nav.appendChild(achievementsBtn);
    }
    
    // 确保所有导航按钮都有正确的事件绑定
    bindNavigationEvents();
}

function createNavigation() {
    const nav = document.createElement('nav');
    nav.className = 'nav';
    nav.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    `;
    
    const flashcardBtn = document.createElement('button');
    flashcardBtn.className = 'nav-btn active';
    flashcardBtn.innerHTML = '📚 卡片学习';
    flashcardBtn.onclick = showFlashcardMode;
    nav.appendChild(flashcardBtn);
    
    document.querySelector('.main-content').parentNode.insertBefore(nav, document.querySelector('.main-content'));
    return nav;
}

function showFlashcardMode(event) {
    // 如果没有传入event，尝试从全局event或通过其他方式获取
    const target = event ? event.target : event?.target || document.querySelector('.nav-btn');
    if (target) {
        setActiveNav(target);
    }
    document.querySelector('.main-content').innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>
        
        <div class="flashcard" id="flashcard" onclick="flipCard()">
            <div class="loading"><div class="spinner"></div></div>
        </div>

        <div class="card-controls">
            <button class="btn btn-secondary" onclick="previousCard()">⬅️ 上一个</button>
            <button class="btn btn-accent" onclick="speakWord()">🔊 发音</button>
            <button class="btn btn-primary" onclick="flipCard()">🔄 翻转</button>
            <button class="btn btn-secondary" onclick="nextCard()">➡️ 下一个</button>
        </div>



        <!-- 使用说明切换按钮 -->
        <div style="margin-top: 32px; text-align: center;">
            <button class="btn btn-secondary" onclick="toggleInstructions()" id="instructionsToggle">
                📖 显示使用说明
            </button>
        </div>

        <!-- 使用说明 -->
        <div id="instructionsPanel" style="margin-top: 16px; padding: 16px; background: var(--bg-color); border-radius: 12px; font-size: 14px; color: var(--text-secondary); display: none;">
            <h4 style="color: var(--text-primary); margin-bottom: 12px;">💡 使用说明</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                <div>
                    <strong>学习模式：</strong><br>
                    • 自动显示模式：同时显示中英文<br>
                    • 翻转卡片模式：需要翻转查看中文<br>
                    • 点击右上角按钮切换模式
                </div>
                <div>
                    <strong>快捷键：</strong><br>
                    • 自动显示：空格键/右箭头切换下一个<br>
                    • 翻转模式：空格键翻转，左右箭头切换<br>
                    • 所有操作都会自动播放发音
                </div>
                <div>
                    <strong>自动加载：</strong><br>
                    • 应用启动时自动加载词汇数据<br>
                    • 包含所有src文件夹中的词汇文件<br>
                    • 无需手动导入，开箱即用
                </div>
            </div>
        </div>
    `;
    showCurrentCard();
    
    // 加载使用说明状态
    setTimeout(() => {
        if (typeof loadInstructionsState === 'function') {
            loadInstructionsState();
        }
    }, 100);
}

function showQuizMode(event) {
    const target = event ? event.target : document.querySelector('[data-feature="quiz"]');
    if (target) {
        setActiveNav(target);
    }
    const quiz = quizSystem.generateQuiz();
    
    if (!quiz) {
        document.querySelector('.main-content').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2>智能测试</h2>
                <p>需要至少4个单词才能开始测试</p>
                <button class="btn btn-primary" onclick="showFlashcardMode()">返回学习</button>
            </div>
        `;
        return;
    }

    quizSystem.currentQuiz = quiz;
    
    document.querySelector('.main-content').innerHTML = `
        <h2>智能测试</h2>
        <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div id="quiz-container">
            <div class="question" id="quizQuestion"></div>
            <div class="options" id="quizOptions"></div>
            <div class="card-controls" style="margin-top: 24px;">
                <button class="btn btn-primary" onclick="nextQuestion()" id="nextQuestionBtn" style="display: none;">下一题</button>
                <button class="btn btn-secondary" onclick="showQuizResults()">查看结果</button>
            </div>
        </div>
    `;

    // 添加测试相关样式
    addQuizStyles();
    displayQuizQuestion(quiz);
}

function displayQuizQuestion(quiz) {
    const questionEl = document.getElementById('quizQuestion');
    const optionsEl = document.getElementById('quizOptions');
    
    let questionText = '';
    let optionContents = [];
    
    switch(quiz.type) {
        case 'chinese-to-english':
            questionText = `"${quiz.correctWord.chinese}" 的英文是？`;
            optionContents = quiz.options.map(word => word.english);
            break;
        case 'english-to-chinese':
            questionText = `"${quiz.correctWord.english}" 的中文意思是？`;
            optionContents = quiz.options.map(word => word.chinese);
            break;
        case 'fill-blank':
            questionText = `请完成句子：${quiz.correctWord.example.en.replace(quiz.correctWord.english, '____')}`;
            optionContents = quiz.options.map(word => word.english);
            break;
        case 'listening':
            questionText = `听发音选择正确的单词`;
            optionContents = quiz.options.map(word => word.english);
            // 自动播放发音
            setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(quiz.correctWord.english);
                utterance.lang = 'en-US';
                speechSynthesis.speak(utterance);
            }, 500);
            break;
    }
    
    questionEl.textContent = questionText;
    optionsEl.innerHTML = optionContents.map((content, index) => 
        `<div class="option" onclick="selectQuizOption(${index})">${content}</div>`
    ).join('');
}

function selectQuizOption(selectedIndex) {
    const result = quizSystem.checkAnswer(selectedIndex, quizSystem.currentQuiz);
    const options = document.querySelectorAll('.option');
    
    // 显示结果
    options.forEach((option, index) => {
        if (index === quizSystem.currentQuiz.correctIndex) {
            option.classList.add('correct');
        } else if (index === selectedIndex && !result.correct) {
            option.classList.add('wrong');
        }
        option.style.pointerEvents = 'none';
    });
    
    // 显示反馈
    const points = result.correct ? Math.max(5, 20 - Math.floor(result.responseTime / 1000)) : 0;
    if (result.correct) {
        showFeedback(`+${points} 积分! 答对了!`, 'easy');
    } else {
        showFeedback('答错了，再接再厉!', 'hard');
    }
    
    updateStats();
    document.getElementById('nextQuestionBtn').style.display = 'block';
}

function nextQuestion() {
    const quiz = quizSystem.generateQuiz();
    if (quiz) {
        quizSystem.currentQuiz = quiz;
        displayQuizQuestion(quiz);
        document.getElementById('nextQuestionBtn').style.display = 'none';
    }
}

function showStatsMode(event) {
    const target = event ? event.target : document.querySelector('[data-feature="stats"]');
    if (target) {
        setActiveNav(target);
    }
    const weeklyData = analytics.getWeeklyProgress();
    const accuracy = quizSystem.getAccuracy();
    const avgResponseTime = quizSystem.getAverageResponseTime();
    const studyStreak = analytics.getStudyStreak();
    
    document.querySelector('.main-content').innerHTML = `
        <h2>学习统计</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <h3>${Object.keys(userStats.wordProgress).length}</h3>
                <p>已学词汇</p>
            </div>
            <div class="stat-card">
                <h3>${accuracy}%</h3>
                <p>测试准确率</p>
            </div>
            <div class="stat-card">
                <h3>${studyStreak}</h3>
                <p>连续学习天数</p>
            </div>
            <div class="stat-card">
                <h3>${avgResponseTime}s</h3>
                <p>平均反应时间</p>
            </div>
        </div>
        
        <h3>本周学习进度</h3>
        <div class="weekly-chart" id="weeklyChart"></div>
        
        <h3>学习建议</h3>
        <div class="recommendations" id="recommendations"></div>
    `;

    addStatsStyles();
    createWeeklyChart(weeklyData);
    showRecommendations();
}

function showAchievements(event) {
    const target = event ? event.target : document.querySelector('[data-feature="achievements"]');
    if (target) {
        setActiveNav(target);
    }
    const unlockedAchievements = gamification.getUnlockedAchievements();
    const totalAchievements = gamification.achievements.length;
    
    document.querySelector('.main-content').innerHTML = `
        <h2>成就系统</h2>
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 24px; margin-bottom: 8px;">
                🏆 ${unlockedAchievements.length} / ${totalAchievements}
            </div>
            <div>已解锁成就</div>
        </div>
        
        <div class="achievements-grid">
            ${gamification.achievements.map(achievement => `
                <div class="achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon">${achievement.unlocked ? '🏆' : '🔒'}</div>
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-desc">${achievement.description}</div>
                </div>
            `).join('')}
        </div>
    `;

    addAchievementStyles();
}

function setActiveNav(target) {
    // 确保target是有效的元素
    if (!target || !target.classList) {
        console.warn('setActiveNav: 无效的目标元素');
        return;
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    target.classList.add('active');
}

// 添加样式函数
function addQuizStyles() {
    if (!document.getElementById('quiz-styles')) {
        const style = document.createElement('style');
        style.id = 'quiz-styles';
        style.textContent = `
            .question {
                font-size: 20px;
                margin-bottom: 24px;
                text-align: center;
                font-weight: 500;
            }
            .options {
                display: grid;
                gap: 12px;
                margin-bottom: 24px;
            }
            .option {
                background: var(--card-bg);
                border: 2px solid var(--border-color);
                border-radius: 12px;
                padding: 16px 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: left;
            }
            .option:hover {
                border-color: var(--primary-color);
                background: var(--primary-color);
                color: white;
            }
            .option.correct {
                border-color: var(--secondary-color);
                background: var(--secondary-color);
                color: white;
            }
            .option.wrong {
                border-color: #ef4444;
                background: #ef4444;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }
}

function addStatsStyles() {
    if (!document.getElementById('stats-styles')) {
        const style = document.createElement('style');
        style.id = 'stats-styles';
        style.textContent = `
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 32px;
            }
            .stat-card {
                background: var(--card-bg);
                border-radius: 12px;
                padding: 24px;
                text-align: center;
                box-shadow: var(--shadow-sm);
                border: 2px solid var(--border-color);
            }
            .stat-card h3 {
                color: var(--primary-color);
                font-size: 28px;
                margin-bottom: 8px;
                font-weight: 700;
            }
            .weekly-chart {
                display: flex;
                gap: 8px;
                justify-content: space-between;
                margin-bottom: 32px;
                padding: 20px;
                background: var(--card-bg);
                border-radius: 12px;
                border: 2px solid var(--border-color);
            }
            .chart-bar {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }
            .bar {
                width: 100%;
                background: var(--primary-color);
                border-radius: 4px;
                min-height: 4px;
                transition: height 0.5s ease;
            }
            .bar-label {
                font-size: 12px;
                color: var(--text-secondary);
            }
            .recommendations {
                display: grid;
                gap: 16px;
            }
            .recommendation {
                padding: 16px;
                background: var(--card-bg);
                border-radius: 12px;
                border: 2px solid var(--border-color);
                border-left: 4px solid var(--accent-color);
            }
        `;
        document.head.appendChild(style);
    }
}

function addAchievementStyles() {
    if (!document.getElementById('achievement-styles-grid')) {
        const style = document.createElement('style');
        style.id = 'achievement-styles-grid';
        style.textContent = `
            .achievements-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
            }
            .achievement-card {
                padding: 24px;
                border-radius: 16px;
                text-align: center;
                transition: all 0.3s ease;
                border: 2px solid var(--border-color);
            }
            .achievement-card.unlocked {
                background: linear-gradient(135deg, #ffd700, #ffed4e);
                color: #333;
                border-color: #ffd700;
                box-shadow: 0 8px 24px rgba(255, 215, 0, 0.2);
            }
            .achievement-card.locked {
                background: var(--card-bg);
                opacity: 0.6;
            }
            .achievement-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            .achievement-name {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            .achievement-desc {
                font-size: 14px;
                opacity: 0.8;
            }
        `;
        document.head.appendChild(style);
    }
}

function createWeeklyChart(weeklyData) {
    const chartContainer = document.getElementById('weeklyChart');
    chartContainer.className = 'weekly-chart';
    
    const maxWords = Math.max(...weeklyData.map(d => d.wordsStudied), 1);
    
    chartContainer.innerHTML = weeklyData.map(day => {
        const height = (day.wordsStudied / maxWords) * 100;
        const dayName = new Date(day.date).toLocaleDateString('zh-CN', { weekday: 'short' });
        
        return `
            <div class="chart-bar">
                <div class="bar" style="height: ${Math.max(height, 4)}px;"></div>
                <div class="bar-label">${dayName}</div>
                <div class="bar-label">${day.wordsStudied}</div>
            </div>
        `;
    }).join('');
}

function showRecommendations() {
    const recommendationsContainer = document.getElementById('recommendations');
    const recommendations = analytics.getRecommendations();
    
    if (recommendations.length === 0) {
        recommendationsContainer.innerHTML = `
            <div class="recommendation">
                <div style="font-weight: 600; color: var(--secondary-color);">🎉 太棒了!</div>
                <div>您的学习状态很好，继续保持！</div>
            </div>
        `;
        return;
    }
    
    recommendationsContainer.innerHTML = recommendations.map(rec => `
        <div class="recommendation">
            <div style="font-weight: 600; margin-bottom: 8px;">💡 建议</div>
            <div>${rec.message}</div>
        </div>
    `).join('');
}

// 确保所有导航按钮正确绑定事件
function bindNavigationEvents() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        const text = btn.textContent || btn.innerHTML;
        if (text.includes('卡片学习')) {
            btn.onclick = showFlashcardMode;
        } else if (text.includes('智能测试')) {
            btn.onclick = showQuizMode;
        } else if (text.includes('学习统计')) {
            btn.onclick = showStatsMode;
        } else if (text.includes('成就系统')) {
            btn.onclick = showAchievements;
        }
    });
}

// 缺失的函数定义
function loadJsonFile() {
    const fileInput = document.getElementById('jsonFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showFeedback('请先选择一个JSON文件', 'normal');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            if (Array.isArray(jsonData) && jsonData.length > 0) {
                wordsData = jsonData.map((word, index) => ({
                    ...word,
                    id: index + 1
                }));
                userStats.totalWords = wordsData.length;
                currentWordIndex = 0;
                updateStats();
                showCurrentCard();
                showFeedback(`成功导入 ${wordsData.length} 个单词！`, 'easy');
            } else {
                showFeedback('文件格式不正确，请检查JSON格式', 'hard');
            }
        } catch (error) {
            showFeedback('文件解析失败，请检查JSON格式', 'hard');
            console.error('JSON解析错误:', error);
        }
    };
    reader.readAsText(file);
}

function markDifficult() {
    if (wordsData.length === 0) return;
    
    const currentWord = wordsData[currentWordIndex];
    spacedRepetition.calculateNextReview(currentWord.id, 'hard');
    analytics.recordStudySession(currentWord.id, 'hard', 1000);
    
    userStats.studiedToday++;
    updateStats();
    showFeedback('已标记为难记，会增加复习频率', 'hard');
    
    // 自动切换到下一个单词
    setTimeout(() => nextCard(), 1000);
}

function markNormal() {
    if (wordsData.length === 0) return;
    
    const currentWord = wordsData[currentWordIndex];
    spacedRepetition.calculateNextReview(currentWord.id, 'normal');
    analytics.recordStudySession(currentWord.id, 'normal', 1000);
    
    userStats.studiedToday++;
    userStats.totalPoints += 10;
    updateStats();
    checkLevelUp();
    showFeedback('+10 积分！正常掌握', 'normal');
    
    // 自动切换到下一个单词
    setTimeout(() => nextCard(), 1000);
}

function markEasy() {
    if (wordsData.length === 0) return;
    
    const currentWord = wordsData[currentWordIndex];
    spacedRepetition.calculateNextReview(currentWord.id, 'easy');
    analytics.recordStudySession(currentWord.id, 'easy', 1000);
    
    userStats.studiedToday++;
    userStats.totalPoints += 15;
    updateStats();
    checkLevelUp();
    showFeedback('+15 积分！轻松掌握！', 'easy');
    
    // 自动切换到下一个单词
    setTimeout(() => nextCard(), 1000);
}

// 导出功能供全局使用
window.quizSystem = quizSystem;
window.analytics = analytics;
window.gamification = gamification; 