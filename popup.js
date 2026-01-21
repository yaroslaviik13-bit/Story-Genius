document.addEventListener('DOMContentLoaded', () => {
    // --- КОНФИГУРАЦИЯ ---
    const BOT_TOKEN = '8063653495:AAET2mcjzfbDbHgwuBaYtvr_dXvlRN6ntb4'; // Получите у @BotFather
    const CHAT_ID = '6904586409'; // Ваш ID в Telegram
    
    // --- ФУНКЦИЯ ПОЛУЧЕНИЯ CHAT_ID ---
    // Для получения вашего chat_id, добавьте в бота временный код:
    // bot.on('message', (msg) => console.log(msg.chat.id))
    
    // --- ОСНОВНЫЕ ПЕРЕМЕННЫЕ ---
    let selectedGenres = [];
    let isGenerating = false;
    let pollInterval = null;
    
    // --- ОСНОВНЫЕ ЭЛЕМЕНТЫ ---
    const storyText = document.getElementById('storyText');
    const storyPrompt = document.getElementById('storyPrompt');
    const lengthSlider = document.getElementById('lengthSlider');
    const currentLength = document.getElementById('currentLength');
    const genreCounter = document.getElementById('genreCounter');
    
    // --- ИНИЦИАЛИЗАЦИЯ ---
    if (storyText) storyText.innerText = "";
    if (currentLength && lengthSlider) {
        currentLength.innerText = lengthSlider.value + ' слов';
    }
    
    // --- ВЫБОР ЖАНРОВ ---
    document.querySelectorAll('.genre-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const genre = card.getAttribute('data-genre');
            
            if (card.classList.contains('selected')) {
                card.classList.remove('selected');
                selectedGenres = selectedGenres.filter(g => g !== genre);
            } else {
                if (selectedGenres.length < 3) {
                    card.classList.add('selected');
                    selectedGenres.push(genre);
                } else {
                    showNotification('Можно выбрать не более 3 жанров', 'info');
                    return;
                }
            }
            
            if (genreCounter) {
                genreCounter.innerText = `${selectedGenres.length}/3`;
            }
        });
    });
    
    // --- ГЛАВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ ---
    async function generateStory(e) {
        if (e) e.preventDefault();
        
        if (isGenerating) {
            showNotification('Подождите, идет генерация...', 'info');
            return;
        }
        
        // Проверка ввода
        const prompt = storyPrompt ? storyPrompt.value.trim() : '';
        if (!prompt) {
            showNotification('Введите идею для истории!', 'error');
            if (storyPrompt) storyPrompt.focus();
            return;
        }
        
        // Получение параметров
        const length = lengthSlider ? lengthSlider.value : '500';
        const style = document.getElementById('styleSelect')?.value || 'immersive';
        const hasDialogue = document.getElementById('dialogueToggle')?.checked || false;
        
        // Создание промпта для бота
        const botPrompt = createBotPrompt(prompt, selectedGenres, length, style, hasDialogue);
        
        // Старт генерации
        isGenerating = true;
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('emptyState');
        const storyContent = document.getElementById('storyContent');
        
        if (emptyState) emptyState.style.display = 'none';
        if (storyContent) storyContent.style.display = 'none';
        if (loading) loading.style.display = 'flex';
        
        try {
            // Шаг 1: Отправляем команду боту
            console.log('Отправляем запрос боту...');
            
            const sendResponse = await sendMessageToBot(botPrompt);
            
            if (!sendResponse.ok) {
                throw new Error('Не удалось отправить запрос боту');
            }
            
            // Шаг 2: Ждем ответ от бота (опрос каждые 2 секунды)
            const story = await waitForBotResponse(30000); // 30 секунд таймаут
            
            if (!story) {
                throw new Error('Бот не ответил вовремя');
            }
            
            // Шаг 3: Показываем результат
            showStoryResult(story, length);
            
        } catch (error) {
            console.error('Ошибка:', error);
            showNotification(`Ошибка: ${error.message}`, 'error');
            
            if (loading) loading.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            isGenerating = false;
            
            // Останавливаем опрос
            if (pollInterval) clearInterval(pollInterval);
        }
    }
    
    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
    
    // Формирование промпта для бота
    function createBotPrompt(prompt, genres, length, style, hasDialogue) {
        let message = `/generate\n`;
        message += `Тема: ${prompt}\n`;
        
        if (genres.length > 0) {
            message += `Жанры: ${genres.join(', ')}\n`;
        }
        
        message += `Длина: ${length} слов\n`;
        message += `Стиль: ${getStyleName(style)}\n`;
        
        if (hasDialogue) {
            message += `Требования: Добавь диалоги\n`;
        }
        
        const plotTwist = document.getElementById('plotTwistToggle')?.checked;
        if (plotTwist) {
            message += `Добавь сюжетный поворот\n`;
        }
        
        const humor = document.getElementById('humorToggle')?.checked;
        if (humor) {
            message += `Добавь нотку юмора\n`;
        }
        
        return message;
    }
    
    function getStyleName(style) {
        const styles = {
            'immersive': 'погружающий',
            'poetic': 'поэтичный',
            'dynamic': 'динамичный',
            'detailed': 'детализированный'
        };
        return styles[style] || style;
    }
    
    // Отправка сообщения боту
    async function sendMessageToBot(message) {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        return response;
    }
    
    // Ожидание ответа от бота
    async function waitForBotResponse(timeout = 30000) {
        return new Promise((resolve, reject) => {
            let elapsed = 0;
            const pollIntervalMs = 2000; // Опрос каждые 2 секунды
            
            pollInterval = setInterval(async () => {
                try {
                    const messages = await getBotMessages();
                    
                    // Ищем последнее сообщение от бота (не наше)
                    if (messages && messages.length > 0) {
                        const lastBotMessage = messages
                            .filter(msg => !msg.text.startsWith('/generate'))
                            .pop();
                        
                        if (lastBotMessage && lastBotMessage.text) {
                            clearInterval(pollInterval);
                            
                            // Очищаем текст от возможных команд
                            let storyText = lastBotMessage.text
                                .replace(/^(История:|Сюжет:|Вот история:).*/i, '')
                                .replace(/^(\n)+/, '')
                                .trim();
                            
                            // Если текст слишком короткий, продолжаем ждать
                            if (storyText.split(' ').length < 10) {
                                return;
                            }
                            
                            resolve(storyText);
                        }
                    }
                    
                    elapsed += pollIntervalMs;
                    if (elapsed >= timeout) {
                        clearInterval(pollInterval);
                        reject(new Error('Таймаут ожидания ответа'));
                    }
                    
                } catch (error) {
                    clearInterval(pollInterval);
                    reject(error);
                }
            }, pollIntervalMs);
        });
    }
    
    // Получение сообщений от бота
    async function getBotMessages() {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.ok && data.result) {
                // Фильтруем сообщения для нашего chat_id
                return data.result
                    .filter(update => update.message && update.message.chat.id.toString() === CHAT_ID.toString())
                    .map(update => ({
                        text: update.message.text || '',
                        date: update.message.date,
                        fromBot: !update.message.from.is_bot
                    }));
            }
            return [];
        } catch (error) {
            console.error('Ошибка получения сообщений:', error);
            return [];
        }
    }
    
    // Показать результат истории
    function showStoryResult(story, length) {
        setTimeout(() => {
            const loading = document.getElementById('loading');
            const storyContent = document.getElementById('storyContent');
            
            if (loading) loading.style.display = 'none';
            if (storyContent) storyContent.style.display = 'block';
            if (storyText) storyText.innerText = story;
            
            updateStoryMetadata(length);
            showNotification('История создана успешно!', 'success');
            
            isGenerating = false;
            if (pollInterval) clearInterval(pollInterval);
        }, 500);
    }
    
    // Обновить метаданные
    function updateStoryMetadata(length) {
        const storyGenres = document.getElementById('storyGenres');
        const storyLength = document.getElementById('storyLength');
        const storyTime = document.getElementById('storyTime');
        
        if (storyGenres) storyGenres.textContent = selectedGenres.join(' • ') || 'Общий';
        if (storyLength) storyLength.textContent = length + ' слов';
        if (storyTime) storyTime.textContent = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // Уведомления
    function showNotification(message, type = 'info') {
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    // --- ПРИМЕРЫ ИДЕЙ ---
    document.querySelectorAll('.example-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const prompt = card.getAttribute('data-prompt');
            if (storyPrompt) {
                storyPrompt.value = prompt;
                showNotification('Идея загружена!', 'info');
            }
        });
    });
    
    // --- КНОПКИ ГЕНЕРАЦИИ ---
    const generateBtns = ['generateBtn', 'generateBtnMain', 'quickGenerateBtn'];
    generateBtns.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', generateStory);
        }
    });
    
    // --- СЛАЙДЕР ---
    if (lengthSlider && currentLength) {
        lengthSlider.addEventListener('input', (e) => {
            currentLength.innerText = e.target.value + ' слов';
        });
    }
    
    console.log('Story Genius инициализирован с Telegram Bot API');
});